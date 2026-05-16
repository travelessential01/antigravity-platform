/**
 * POST /api/acknowledge
 *
 * 1-click deep-link acknowledgment endpoint.
 * Uses a DB-backed helper so complaint status changes, notification consumption,
 * and processed_events completion happen together.
 *
 * Security layers:
 *   - Rate limit: 5 req/min per IP
 *   - HMAC-signed token with 15-minute TTL
 *   - Issuance proof via notifications.secure_link_id
 *   - Idempotent completion key in processed_events
 *   - Service-role auth because deep links run outside a user session
 */

import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/inngest/client'
import {
  ACKNOWLEDGE_LINK_TTL_SECONDS,
  createAcknowledgeToken,
  verifyAcknowledgeToken,
} from '@/lib/acknowledgement-links'
import { logger } from '@/lib/logger'
import { rateLimitAcknowledge } from '@/lib/rate-limit-acknowledge'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AcknowledgeRpcOutcome =
  | 'acknowledged'
  | 'already_acknowledged'
  | 'already_read'
  | 'expired'
  | 'unknown'
  | 'complaint_missing'

type AcknowledgeRpcRow = {
  outcome: AcknowledgeRpcOutcome
  complaint_id: string
  notification_id: string | null
  notification_consumed: boolean
  should_cancel_primary: boolean
}

type DevFixtureResult = {
  complaintId: string
  notificationId: string
  recipientId: string
}

function buildEscalationDeepLink(input: { complaintId: string; token: string; escalated?: boolean }) {
  const query = new URLSearchParams({
    context: input.complaintId,
    token: input.token,
  })

  if (input.escalated) {
    query.set('escalated', 'true')
  }

  return `/dashboard/escalations?${query.toString()}`
}

function parseOptionalInteger(raw: string | null) {
  if (!raw) return undefined

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function resolveActiveRecipientId(supabase: ReturnType<typeof createAdminClient>, hospitalId: string) {
  const { data: sameHospitalRecipient } = await supabase
    .from('users')
    .select('id')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (sameHospitalRecipient?.id) {
    return sameHospitalRecipient.id
  }

  const { data: fallbackRecipient } = await supabase
    .from('users')
    .select('id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  return fallbackRecipient?.id ?? null
}

async function ensureDevAcknowledgeFixture(
  supabase: ReturnType<typeof createAdminClient>,
  input: { complaintId: string; linkId: string; token: string }
): Promise<DevFixtureResult> {
  const existingComplaint = await supabase
    .from('complaints')
    .select('id, hospital_id, department_id')
    .eq('id', input.complaintId)
    .maybeSingle()

  let complaintId = input.complaintId
  let hospitalId = existingComplaint.data?.hospital_id ?? null

  if (!hospitalId) {
    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('id, hospital_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (departmentError || !department?.hospital_id) {
      throw new Error('No department fixture is available for acknowledge-route testing.')
    }

    hospitalId = department.hospital_id

    let patientId: string | null = null
    const existingPatient = await supabase
      .from('patients')
      .select('id')
      .eq('hospital_id', hospitalId)
      .limit(1)
      .maybeSingle()

    if (existingPatient.data?.id) {
      patientId = existingPatient.data.id
    } else {
      const createdPatient = await supabase
        .from('patients')
        .insert({
          hospital_id: hospitalId,
          contact_hash: `dev-fixture:${complaintId}`,
        })
        .select('id')
        .single()

      if (createdPatient.error || !createdPatient.data?.id) {
        throw new Error('Failed to create a patient fixture for acknowledge-route testing.')
      }

      patientId = createdPatient.data.id
    }

    const complaintInsert = await supabase
      .from('complaints')
      .insert({
        id: complaintId,
        hospital_id: hospitalId,
        department_id: department.id,
        patient_id: patientId,
        status: 'submitted',
        severity_level: 'high',
      })
      .select('id')
      .single()

    if (complaintInsert.error || !complaintInsert.data?.id) {
      throw new Error('Failed to create a complaint fixture for acknowledge-route testing.')
    }

    complaintId = complaintInsert.data.id
  }

  const recipientId = await resolveActiveRecipientId(supabase, hospitalId)
  if (!recipientId) {
    throw new Error('No active staff user fixture is available for acknowledge-route testing.')
  }

  const existingNotification = await supabase
    .from('notifications')
    .select('id')
    .eq('complaint_id', complaintId)
    .eq('secure_link_id', input.linkId)
    .maybeSingle()

  if (existingNotification.data?.id) {
    return {
      complaintId,
      notificationId: existingNotification.data.id,
      recipientId,
    }
  }

  const deepLink = buildEscalationDeepLink({
    complaintId,
    token: input.token,
  })

  const notificationInsert = await supabase
    .from('notifications')
    .insert({
      recipient_id: recipientId,
      complaint_id: complaintId,
      channel: 'in_app',
      secure_link_id: input.linkId,
      deep_link: deepLink,
      status: 'pending',
    })
    .select('id')
    .single()

  if (notificationInsert.error || !notificationInsert.data?.id) {
    throw new Error('Failed to create a notification fixture for acknowledge-route testing.')
  }

  return {
    complaintId,
    notificationId: notificationInsert.data.id,
    recipientId,
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const rateCheck = await rateLimitAcknowledge(ip)
  if (!rateCheck.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      { status: 429 }
    )
  }

  let body: { token?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const payload = verifyAcknowledgeToken(body.token)
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token. Deep-links expire after 15 minutes.' },
      { status: 401 }
    )
  }

  const { complaintId, linkId } = payload
  const supabase = createAdminClient()

  const { data: acknowledgeData, error: acknowledgeError } = await supabase.rpc(
    'acknowledge_notification_link',
    {
      p_complaint_id: complaintId,
      p_secure_link_id: linkId,
    }
  )

  if (acknowledgeError) {
    logger.error('[acknowledge] DB helper failed', {
      complaintId,
      linkId,
      error: acknowledgeError.message,
    })
    return NextResponse.json({ error: 'Failed to validate secure link.' }, { status: 500 })
  }

  const result = (Array.isArray(acknowledgeData) ? acknowledgeData[0] : acknowledgeData) as
    | AcknowledgeRpcRow
    | null

  if (!result) {
    logger.error('[acknowledge] DB helper returned no result', {
      complaintId,
      linkId,
    })
    return NextResponse.json({ error: 'Failed to validate secure link.' }, { status: 500 })
  }

  if (result.outcome === 'unknown') {
    return NextResponse.json({ error: 'Unknown or revoked secure link.' }, { status: 401 })
  }

  if (result.outcome === 'expired') {
    return NextResponse.json({ error: 'Secure link has expired.' }, { status: 410 })
  }

  if (result.outcome === 'complaint_missing') {
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
  }

  try {
    const events: Promise<unknown>[] = []

    if (result.notification_consumed) {
      events.push(
        inngest.send({
          name: 'complaint/notification_read',
          data: { complaintId: result.complaint_id },
        })
      )
    }

    if (result.should_cancel_primary) {
      events.push(
        inngest.send({
          name: 'complaint/acknowledged',
          data: { complaintId: result.complaint_id },
        })
      )
    }

    if (events.length > 0) {
      await Promise.all(events)
    }
  } catch (err) {
    logger.warn('[acknowledge] Inngest follow-up failed (non-fatal)', {
      complaintId,
      outcome: result.outcome,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const responseMessage =
    result.outcome === 'acknowledged'
      ? 'Complaint acknowledged. SLA timer cancelled.'
      : 'Complaint already acknowledged.'

  logger.info('[acknowledge] Complaint acknowledged via secure link', {
    complaintId: result.complaint_id,
    secureLinkId: linkId,
    ip,
    outcome: result.outcome,
  })

  return NextResponse.json(
    {
      success: true,
      complaintId: result.complaint_id,
      outcome: result.outcome,
      message: responseMessage,
    },
    { status: 200 }
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const complaintId = req.nextUrl.searchParams.get('complaintId') ?? crypto.randomUUID()
  const linkId = req.nextUrl.searchParams.get('linkId') ?? crypto.randomUUID()
  const expiresInSeconds = parseOptionalInteger(req.nextUrl.searchParams.get('expiresInSeconds'))
  const shouldSeedFixture = req.nextUrl.searchParams.get('seed') === '1'

  const token = createAcknowledgeToken({
    complaintId,
    linkId,
    expiresInSeconds,
  })

  if (shouldSeedFixture) {
    try {
      const supabase = createAdminClient()
      const fixture = await ensureDevAcknowledgeFixture(supabase, {
        complaintId,
        linkId,
        token,
      })

      return NextResponse.json({
        message: 'Signed token and matching dev fixture created for /api/acknowledge testing.',
        complaintId: fixture.complaintId,
        linkId,
        token,
        expiresInSeconds: expiresInSeconds ?? ACKNOWLEDGE_LINK_TTL_SECONDS,
        note: 'This dev helper provisioned a pending in-app notification that matches the secure link.',
        usage: `POST /api/acknowledge with body: { "token": "${token}" }`,
      })
    } catch (error) {
      logger.error('[acknowledge] Failed to seed dev fixture', {
        complaintId,
        linkId,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json(
        { error: 'Failed to create an acknowledge test fixture.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    message: 'Signed token for testing /api/acknowledge (dev only)',
    complaintId,
    linkId,
    token,
    expiresInSeconds: expiresInSeconds ?? ACKNOWLEDGE_LINK_TTL_SECONDS,
    note: 'The token is only accepted when notifications.secure_link_id matches linkId.',
    usage: `POST /api/acknowledge with body: { "token": "${token}" }`,
  })
}
