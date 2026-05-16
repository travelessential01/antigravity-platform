/**
 * src/lib/webauthn.ts — WebAuthn / FIDO2 Server-Side Helpers
 * Phase 3.1 — StayAssist V1 Auth Architecture
 *
 * Wraps @simplewebauthn/server for:
 *   - Registration: generating options + verifying the authenticator response
 *   - Authentication: generating challenge + verifying assertion + updating counter
 *
 * Design notes:
 *   - Private keys NEVER leave the device. Only the public key is stored.
 *   - counter is verified monotonically on every assertion (replay attack prevention).
 *   - rpId must match the origin domain exactly (no subdomain mismatches).
 *   - All writes use service_role to bypass RLS (webauthn_credentials policies require it).
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  AUTH_METHOD_COOKIE,
  WEBAUTHN_CHALLENGE_COOKIE,
} from '@/lib/auth-session-cookies'

function encodePublicKeyBytea(publicKey: Uint8Array): string {
  return `\\x${Buffer.from(publicKey).toString('hex')}`
}

function decodePublicKeyBytea(value: unknown): ReturnType<Uint8Array['slice']> {
  if (value instanceof Uint8Array) {
    return value.slice()
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value).slice()
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value).slice()
  }

  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    'data' in value &&
    (value as { type?: unknown }).type === 'Buffer' &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return Uint8Array.from((value as { data: number[] }).data).slice()
  }

  if (typeof value === 'string') {
    const normalized = value.startsWith('\\x') ? value.slice(2) : value

    if (!normalized) {
      throw new Error('Stored credential public key is empty.')
    }

    if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
      throw new Error('Stored credential public key is not valid BYTEA hex data.')
    }

    return Uint8Array.from(Buffer.from(normalized, 'hex')).slice()
  }

  throw new Error('Stored credential public key has an unsupported format.')
}

// ── Config ────────────────────────────────────────────────────────────────────

function getConfig() {
  const rpId = process.env.WEBAUTHN_RP_ID ?? 'localhost'
  const rpName = process.env.WEBAUTHN_RP_NAME ?? 'StayAssist'
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${rpId}`
  return { rpId, rpName, origin }
}

// Challenge TTL: 5 minutes (stored as base64 in Redis or a simple DB table)
// For simplicity in V1, we store the challenge in an HttpOnly cookie.
const CHALLENGE_TTL_S = 300

// ── Service Client Factory ─────────────────────────────────────────────────────

async function getServiceClient() {
  return createAdminClient()
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * generateWebAuthnRegistrationOptions()
 *
 * Returns a PublicKeyCredentialCreationOptionsJSON to send to the browser.
 * The random challenge is stored in an HttpOnly cookie for verification.
 *
 * @param userId  — public.users.id (app UUID)
 * @param phone   — used as the human-readable account identifier
 */
export async function generateWebAuthnRegistrationOptions(userId: string, phone: string) {
  const cookieStore = await cookies()
  const { rpId, rpName } = getConfig()

  // Fetch any existing credentials to exclude (prevents re-registration of same device)
  const supabase = await getServiceClient()
  const { data: existingCreds } = await supabase
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId)

  const excludeCredentials = (existingCreds ?? []).map((c) => ({
    id: c.credential_id as string,
    transports: (c.transports ?? []) as AuthenticatorTransport[],
  }))

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userID: new TextEncoder().encode(userId),
    userName: phone,
    userDisplayName: phone,
    attestationType: 'none',             // No attestation in V1 (simpler, sufficient)
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Face ID / Fingerprint / Windows Hello only
      residentKey: 'preferred',
      userVerification: 'required',        // Biometric verification is mandatory
    },
    excludeCredentials,
  })

  // Store challenge in HttpOnly cookie for 5 minutes
  cookieStore.set(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: CHALLENGE_TTL_S,
    path: '/',
  })

  return options
}

/**
 * verifyWebAuthnRegistration()
 *
 * Verifies the authenticator's registration response and stores the credential.
 *
 * @param userId    — public.users.id
 * @param deviceName — human-readable label (e.g. "iPhone 15 Pro")
 * @param response  — RegistrationResponseJSON from the browser
 */
export async function verifyWebAuthnRegistration(
  userId: string,
  deviceName: string,
  response: RegistrationResponseJSON
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  const { rpId, origin } = getConfig()

  const expectedChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value
  if (!expectedChallenge) {
    return { success: false, error: 'Registration challenge expired. Please try again.' }
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
    })
  } catch (err) {
    return { success: false, error: `Verification failed: ${String(err)}` }
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { success: false, error: 'Authenticator verification failed.' }
  }

  const { credential, aaguid } = verification.registrationInfo

  // Clear used challenge
  cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE)

  // Store credential in DB (service_role bypasses RLS write restriction)
  const supabase = await getServiceClient()
  const { error: insertError } = await supabase.from('webauthn_credentials').insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: encodePublicKeyBytea(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    device_name: deviceName,
    aaguid: aaguid ?? null,
  })

  if (insertError) {
    return { success: false, error: 'Failed to save credential. Please try again.' }
  }

  return { success: true }
}

// ── Authentication ────────────────────────────────────────────────────────────

/**
 * generateWebAuthnAuthenticationOptions()
 *
 * Returns a PublicKeyCredentialRequestOptionsJSON for the browser.
 * Scoped to credentials already registered by this user.
 *
 * @param userId — public.users.id
 */
export async function generateWebAuthnAuthenticationOptions(userId: string) {
  const cookieStore = await cookies()
  const { rpId } = getConfig()

  const supabase = await getServiceClient()
  const { data: creds } = await supabase
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId)

  if (!creds || creds.length === 0) {
    throw new Error('No registered credentials found for this user.')
  }

  const allowCredentials = creds.map((c) => ({
    id: c.credential_id as string,
    transports: (c.transports ?? []) as AuthenticatorTransport[],
  }))

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials,
    userVerification: 'required',
  })

  // Store challenge
  cookieStore.set(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: CHALLENGE_TTL_S,
    path: '/',
  })

  return options
}

/**
 * verifyWebAuthnAuthentication()
 *
 * Verifies the authenticator assertion and updates the counter.
 * On success, marks the session as biometric-verified.
 *
 * @param userId   — public.users.id
 * @param response — AuthenticationResponseJSON from the browser
 */
export async function verifyWebAuthnAuthentication(
  userId: string,
  response: AuthenticationResponseJSON
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies()
  const { rpId, origin } = getConfig()

  const expectedChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value
  if (!expectedChallenge) {
    return { success: false, error: 'Authentication challenge expired. Please try again.' }
  }

  const supabase = await getServiceClient()

  // Fetch stored credential by credential_id
  const { data: storedCred } = await supabase
    .from('webauthn_credentials')
    .select('id, credential_id, public_key, counter, transports')
    .eq('user_id', userId)
    .eq('credential_id', response.id)
    .single()

  if (!storedCred) {
    return { success: false, error: 'Credential not found.' }
  }

  let verification
  try {
    const storedPublicKey = decodePublicKeyBytea(storedCred.public_key)

    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: storedCred.credential_id as string,
        publicKey: storedPublicKey,
        counter: storedCred.counter as number,
        transports: (storedCred.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    })
  } catch (err) {
    return { success: false, error: `Assertion verification failed: ${String(err)}` }
  }

  if (!verification.verified) {
    return { success: false, error: 'Biometric verification failed.' }
  }

  const { newCounter } = verification.authenticationInfo

  // Replay attack check — counter must strictly increase
  if (
    (newCounter > 0 || (storedCred.counter as number) > 0) &&
    newCounter <= (storedCred.counter as number)
  ) {
    return { success: false, error: 'Replay attack detected. Credential rejected.' }
  }

  // Update counter + last_used_at
  await supabase
    .from('webauthn_credentials')
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq('id', storedCred.id)

  // Clear used challenge
  cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE)

  // Mark session as biometric-verified via cookie
  // This signals the auth-guard that aal2 elevation was achieved via WebAuthn
  cookieStore.set(AUTH_METHOD_COOKIE, 'webauthn', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 8,  // 8 hours — matches JWT session
    path: '/',
  })

  return { success: true }
}
