/**
 * /api/auth/webauthn/authenticate/options/route.ts
 * Phase 3.3 — WebAuthn Authentication Step 1
 *
 * GET — returns PublicKeyCredentialRequestOptionsJSON scoped to this user's enrolled credentials.
 * Requires: aal1 session.
 */

import { NextResponse } from 'next/server'
import { requireUser, AuthError } from '@/lib/auth-guard'
import { generateWebAuthnAuthenticationOptions } from '@/lib/webauthn'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireUser()
    const options = await generateWebAuthnAuthenticationOptions(user.id)
    return NextResponse.json(options)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    logger.error('[WebAuthn:authenticate:options]', { error: String(err) })
    return NextResponse.json({ error: 'Failed to generate authentication options.' }, { status: 500 })
  }
}
