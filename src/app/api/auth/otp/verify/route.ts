/**
 * src/app/api/auth/otp/verify/route.ts
 * Phase 2.3 - StayAssist V1 Auth Architecture
 *
 * POST /api/auth/otp/verify
 *
 * DEVELOPMENT STAGE: Accepts "000000" as the universal OTP for all phone numbers.
 * On success:
 *   - Creates a Supabase session (aal1)
 *   - Runs login risk assessment
 *   - Returns next action for the client router:
 *       'post_login' -> /auth/post-login (MFA paused for non-production walkthroughs)
 *       'totp'       -> /auth/mfa/enroll (entrypoint that redirects to challenge if already enrolled)
 *       'biometric'  -> /auth/biometric/challenge
 *       'register'   -> /auth/biometric/register (first-time staff)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  findStaffLoginContext,
  isStaffLoginLookupNotFound,
  STAFF_LOGIN_PUBLIC_FAILURE_MESSAGE,
  type StaffLoginCandidate,
} from '@/lib/staff-login'
import {
  isLivePhoneOtpEnabled,
  isMfaEnforcementPaused,
  isMockPhoneOtpAllowed,
} from '@/lib/auth-utils'
import {
  computeRiskScore,
  deriveDeviceFingerprint,
  getUserLoginHistory,
  recordLoginEvent,
} from '@/lib/login-risk'
import {
  clearOtpFailureCount,
  getOtpFailureCount,
  incrementOtpFailureCount,
  rateLimitOtpVerifyByIp,
  rateLimitOtpVerifyBySubject,
} from '@/lib/rate-limit-auth'
import { clearAuthContextCookies } from '@/lib/auth-session-cookies'

export const runtime = 'nodejs'

const MOCK_OTP = '000000'

function maskPhone(phone: string): string {
  return phone.slice(0, 6) + '****'
}

function jsonWithClearedAuthContext(
  body: Record<string, unknown>,
  init?: ResponseInit
) {
  const response = NextResponse.json(body, init)
  clearAuthContextCookies(response)
  return response
}

async function getWebAuthnState(svcSupabase: SupabaseClient, staffUserId: string) {
  const { count: webAuthnCount } = await svcSupabase
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', staffUserId)

  const { count: deptCount } = await svcSupabase
    .from('user_department_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', staffUserId)
    .eq('is_active', true)

  return {
    hasWebAuthn: (webAuthnCount ?? 0) > 0,
    isFloat: (deptCount ?? 0) > 1,
  }
}

function resolveMockSessionBootstrapError(staffUser: StaffLoginCandidate) {
  if (!staffUser.email) {
    return 'Staff account is missing the email identity required for login bootstrap.'
  }

  return null
}

function resolveNextAction(
  role: string,
  riskLevel: string | null,
  hasWebAuthn: boolean,
  mfaPaused: boolean
): 'post_login' | 'totp' | 'biometric' | 'register' {
  if (mfaPaused) {
    return 'post_login'
  }

  if (role === 'admin' || role === 'dpo' || riskLevel === 'high') {
    return 'totp'
  }

  if (!hasWebAuthn) {
    return 'register'
  }

  return 'biometric'
}

export async function POST(req: NextRequest) {
  let phone: string
  let token: string
  let hospitalCode: string

  try {
    const body = await req.json() as { phone?: string; token?: string; hospitalCode?: string }
    phone = (body.phone ?? '').trim()
    token = (body.token ?? '').trim()
    hospitalCode = (body.hospitalCode ?? '').trim().toUpperCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!phone || !token || !hospitalCode) {
    return NextResponse.json({ error: 'phone, token, and hospitalCode are required' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const subjectKey = `${hospitalCode}:${phone}`
  const mockOtpAllowed = isMockPhoneOtpAllowed()

  if (!mockOtpAllowed) {
    const [ipLimit, subjectLimit] = await Promise.all([
      rateLimitOtpVerifyByIp(ip),
      rateLimitOtpVerifyBySubject(subjectKey),
    ])

    if (!ipLimit.success) {
      return NextResponse.json({ error: ipLimit.error }, { status: 429 })
    }

    if (!subjectLimit.success) {
      return NextResponse.json({ error: subjectLimit.error }, { status: 429 })
    }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          ),
      },
    }
  )

  const svcSupabase = createAdminClient()

  const lookup = await findStaffLoginContext(svcSupabase, { phone, hospitalCode })
  if (lookup.error) {
    if (lookup.error.code === 'LOOKUP_FAILED') {
      logger.error('[OTP:verify] Staff login lookup failed', {
        hospitalCode,
        phone: maskPhone(phone),
      })
      return NextResponse.json(
        { error: 'Failed to verify staff access. Please try again.' },
        { status: 500 }
      )
    }

    logger.warn('[OTP:verify] Staff login lookup rejected', {
      code: lookup.error.code,
      hospitalCode,
      phone: maskPhone(phone),
    })
    return NextResponse.json(
      { error: STAFF_LOGIN_PUBLIC_FAILURE_MESSAGE },
      { status: isStaffLoginLookupNotFound(lookup.error.code) ? 404 : 400 }
    )
  }
  if (!lookup.context) {
    return NextResponse.json({ error: 'Failed to verify staff access. Please try again.' }, { status: 500 })
  }

  const { hospital, staffUser } = lookup.context
  const phoneOtpEnabled = isLivePhoneOtpEnabled()

  // DEVELOPMENT STAGE: Mock OTP
  if (mockOtpAllowed) {
    if (token !== MOCK_OTP) {
      await incrementOtpFailureCount(subjectKey)
      return NextResponse.json(
        { error: 'Invalid OTP. (Development stage: use 000000)' },
        { status: 401 }
      )
    }

    const bootstrapError = resolveMockSessionBootstrapError(staffUser)
    if (bootstrapError) {
      logger.error('[OTP:verify] Mock bootstrap blocked', {
        userId: staffUser.id,
        hospitalId: hospital.id,
      })
      return NextResponse.json({ error: bootstrapError }, { status: 500 })
    }

    let accessToken: string | undefined
    let refreshToken: string | undefined

    const { data: linkData } = await svcSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: staffUser.email!,
    })
    const emailOtp = linkData?.properties?.email_otp
    if (emailOtp) {
      const { data: sessionData } = await supabase.auth.verifyOtp({
        email: staffUser.email!,
        token: emailOtp,
        type: 'email',
      })
      accessToken = sessionData?.session?.access_token
      refreshToken = sessionData?.session?.refresh_token

      if (staffUser.auth_user_id && sessionData?.user?.id && staffUser.auth_user_id !== sessionData.user.id) {
        await supabase.auth.signOut()
        logger.warn('[OTP:verify] Mock identity mismatch', {
          userId: staffUser.id,
          existingAuthUserId: staffUser.auth_user_id,
          authUserId: sessionData.user.id,
        })
        return jsonWithClearedAuthContext(
          { error: 'This login does not match the assigned staff identity for that hospital.' },
          { status: 403 }
        )
      }

      if (sessionData?.user?.id && !staffUser.auth_user_id) {
        await svcSupabase
          .from('users')
          .update({ auth_user_id: sessionData.user.id })
          .eq('id', staffUser.id)
        logger.info('[OTP:verify] Backfilled auth_user_id', {
          userId: staffUser.id,
          authUserId: sessionData.user.id,
        })
      }
    }

    if (!accessToken || !refreshToken) {
      logger.error('[OTP:verify] Mock bootstrap did not create a browser session', {
        userId: staffUser.id,
        hospitalId: hospital.id,
      })
      return NextResponse.json(
        { error: 'Login bootstrap failed. Please contact your administrator.' },
        { status: 500 }
      )
    }

    const { hasWebAuthn, isFloat } = await getWebAuthnState(svcSupabase, staffUser.id)
    const mfaPaused = isMfaEnforcementPaused()
    await clearOtpFailureCount(subjectKey)

    logger.info('[OTP:verify] MOCK OTP accepted', {
      role: staffUser.role,
      hospitalId: hospital.id,
      hasWebAuthn,
      isFloat,
      mfaPaused,
    })

    return jsonWithClearedAuthContext({
      success: true,
      nextAction: resolveNextAction(staffUser.role, 'low', hasWebAuthn, mfaPaused),
      accessToken,
      refreshToken,
    })
  }

  if (!phoneOtpEnabled) {
    logger.error('[OTP:verify] Phone OTP disabled in production-like environment.', {
      hospitalCode,
      hospitalId: hospital.id,
    })
    return NextResponse.json(
      { error: 'OTP login is temporarily unavailable. Contact your administrator.' },
      { status: 503 }
    )
  }

  // Production: Verify via Supabase GoTrue
  const { data: otpResult, error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (verifyError || !otpResult?.user) {
    await incrementOtpFailureCount(subjectKey)
    logger.warn('[OTP:verify] Invalid OTP', { error: verifyError?.message })
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 401 })
  }

  if (staffUser.auth_user_id && staffUser.auth_user_id !== otpResult.user.id) {
    await supabase.auth.signOut()
    logger.warn('[OTP:verify] Auth identity mismatch', {
      userId: staffUser.id,
      existingAuthUserId: staffUser.auth_user_id,
      authUserId: otpResult.user.id,
    })
    return jsonWithClearedAuthContext(
      { error: 'This login does not match the assigned staff identity for that hospital.' },
      { status: 403 }
    )
  }

  if (!staffUser.auth_user_id) {
    await svcSupabase
      .from('users')
      .update({ auth_user_id: otpResult.user.id })
      .eq('id', staffUser.id)
    logger.info('[OTP:verify] Backfilled auth_user_id', {
      userId: staffUser.id,
      authUserId: otpResult.user.id,
    })
  }

  const userAgent = req.headers.get('user-agent') ?? ''
  const acceptLanguage = req.headers.get('accept-language') ?? ''
  const ipCountry = req.headers.get('cf-ipcountry') ?? 'XX'
  const fingerprint = deriveDeviceFingerprint(userAgent, acceptLanguage, '')
  const consecutiveFailures = await getOtpFailureCount(subjectKey)

  const { knownDevices, lastCountry } = await getUserLoginHistory(otpResult.user.id)
  const assessment = computeRiskScore(
    { deviceFingerprintHash: fingerprint, ipCountry, consecutiveFailures, authUserId: otpResult.user.id },
    knownDevices,
    lastCountry
  )

  await recordLoginEvent({
    authUserId: otpResult.user.id,
    assessment,
    fingerprint,
    ipCountry,
    phone,
    hospitalId: hospital.id,
  })

  const { hasWebAuthn, isFloat } = await getWebAuthnState(svcSupabase, staffUser.id)
  const mfaPaused = isMfaEnforcementPaused()

  logger.info('[OTP:verify] LIVE OTP accepted', {
    role: staffUser.role,
    hospitalId: hospital.id,
    hasWebAuthn,
    isFloat,
    riskLevel: assessment.level,
    mfaPaused,
  })
  await clearOtpFailureCount(subjectKey)

  return jsonWithClearedAuthContext({
    success: true,
    nextAction: resolveNextAction(staffUser.role, assessment.level, hasWebAuthn, mfaPaused),
    accessToken: otpResult.session?.access_token,
    refreshToken: otpResult.session?.refresh_token,
  })
}
