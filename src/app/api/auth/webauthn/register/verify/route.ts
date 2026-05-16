/**
 * /api/auth/webauthn/register/verify/route.ts
 * Phase 3.2 — WebAuthn Registration Step 2
 *
 * POST — verifies the browser's RegistrationResponseJSON and stores the credential.
 * Body: { response: RegistrationResponseJSON, deviceName: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/types'
import { requireUser, AuthError } from '@/lib/auth-guard'
import { verifyWebAuthnRegistration } from '@/lib/webauthn'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json() as { response: RegistrationResponseJSON; deviceName?: string }

    if (!body.response) {
      return NextResponse.json({ error: 'Missing registration response.' }, { status: 400 })
    }

    const deviceName = body.deviceName
      ?? req.headers.get('user-agent')?.split('/')[0]
      ?? 'Unknown Device'

    const result = await verifyWebAuthnRegistration(user.id, deviceName, body.response)

    if (!result.success) {
      logger.warn('[WebAuthn:register:verify] Failed', { error: result.error, userId: user.id })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const svcSupabase = createAdminClient()
    const { count } = await svcSupabase
      .from('user_department_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const nextAction = (count ?? 0) > 1 ? 'dept_select' : 'dashboard'

    logger.info('[WebAuthn:register:verify] Credential enrolled', {
      userId: user.id,
      deviceName,
      nextAction,
    })
    return NextResponse.json({ success: true, nextAction })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    logger.error('[WebAuthn:register:verify]', { error: String(err) })
    return NextResponse.json({ error: 'Registration verification failed.' }, { status: 500 })
  }
}
