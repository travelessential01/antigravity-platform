import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireUser } from '@/lib/auth-guard'
import type { MFAAuditEvent } from '@/lib/mfa-audit-events'
import { writeMfaAuditEvent } from '@/lib/mfa-audit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

function isMfaAuditEvent(value: unknown): value is MFAAuditEvent {
  return (
    value === 'MFA Setup Completed'
    || value === 'MFA Challenge Passed'
    || value === 'MFA Challenge Failed'
  )
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json() as {
      eventType?: unknown
      metadata?: Record<string, unknown>
    }

    if (!isMfaAuditEvent(body.eventType)) {
      return NextResponse.json({ error: 'Invalid MFA audit event type.' }, { status: 400 })
    }

    const result = await writeMfaAuditEvent(user.id, body.eventType, body.metadata ?? {})
    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    logger.error('[MFA:audit]', { error: String(error) })
    return NextResponse.json({ error: 'Failed to record MFA audit event.' }, { status: 500 })
  }
}
