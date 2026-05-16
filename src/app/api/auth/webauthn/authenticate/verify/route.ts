/**
 * /api/auth/webauthn/authenticate/verify/route.ts
 * Phase 3.3 — WebAuthn Authentication Step 2
 *
 * POST — verifies the authenticator assertion, updates counter, elevates session to aal2.
 * Body: { response: AuthenticationResponseJSON }
 *
 * On success: sets sa_auth_method=webauthn HttpOnly cookie (aal2 marker).
 * Returns: { success: true, nextAction: 'dept_select' | 'dashboard' }
 */

import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/types'
import { requireUser, AuthError } from '@/lib/auth-guard'
import { verifyWebAuthnAuthentication } from '@/lib/webauthn'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json() as { response: AuthenticationResponseJSON }

    if (!body.response) {
      return NextResponse.json({ error: 'Missing authentication response.' }, { status: 400 })
    }

    const result = await verifyWebAuthnAuthentication(user.id, body.response)

    if (!result.success) {
      logger.warn('[WebAuthn:authenticate:verify] Failed', { error: result.error, userId: user.id })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Determine if this is a float staff user (has multiple dept assignments)
    const svcSupabase = createAdminClient()

    const { count } = await svcSupabase
      .from('user_department_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const isFloat = (count ?? 0) > 1
    const nextAction = isFloat ? 'dept_select' : 'dashboard'

    logger.info('[WebAuthn:authenticate:verify] Biometric verified', {
      userId: user.id,
      staffType: user.staffType,
      nextAction,
    })

    return NextResponse.json({ success: true, nextAction })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    logger.error('[WebAuthn:authenticate:verify]', { error: String(err) })
    return NextResponse.json({ error: 'Authentication verification failed.' }, { status: 500 })
  }
}
