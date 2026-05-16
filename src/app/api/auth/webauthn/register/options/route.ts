/**
 * /api/auth/webauthn/register/options/route.ts
 * Phase 3.2 — WebAuthn Registration Step 1
 *
 * GET — returns PublicKeyCredentialCreationOptionsJSON for the browser.
 * Requires: aal1 session (staff must be logged in via OTP first).
 */

import { NextResponse } from 'next/server'
import { requireUser, AuthError } from '@/lib/auth-guard'
import { generateWebAuthnRegistrationOptions } from '@/lib/webauthn'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireUser()
    const options = await generateWebAuthnRegistrationOptions(user.id, user.phone)
    return NextResponse.json(options)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    logger.error('[WebAuthn:register:options]', { error: String(err) })
    return NextResponse.json({ error: 'Failed to generate registration options.' }, { status: 500 })
  }
}
