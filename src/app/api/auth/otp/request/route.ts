/**
 * POST /api/auth/otp/request
 *
 * Development stage:
 * - No real SMS is sent until the phone provider is enabled.
 * - Mock mode returns success and the verify step accepts `000000`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  findStaffLoginContext,
  isStaffLoginLookupNotFound,
  STAFF_LOGIN_PUBLIC_FAILURE_MESSAGE,
} from '@/lib/staff-login'
import { isLivePhoneOtpEnabled, isMockPhoneOtpAllowed } from '@/lib/auth-utils'
import {
  rateLimitOtpRequestByIp,
  rateLimitOtpRequestBySubject,
} from '@/lib/rate-limit-auth'

export const runtime = 'nodejs'

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}

function maskPhone(phone: string): string {
  return phone.slice(0, 6) + '****'
}

export async function POST(req: NextRequest) {
  let phone: string
  let hospitalCode: string

  try {
    const body = (await req.json()) as { phone?: string; hospitalCode?: string }
    phone = (body.phone ?? '').trim()
    hospitalCode = (body.hospitalCode ?? '').trim().toUpperCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!phone || !isValidE164(phone)) {
    return NextResponse.json(
      { error: 'Phone number must be in E.164 format (e.g. +919876543210)' },
      { status: 400 }
    )
  }

  if (!hospitalCode || !/^[A-Z0-9]{6}$/.test(hospitalCode)) {
    return NextResponse.json(
      { error: 'Hospital code must be exactly 6 alphanumeric characters' },
      { status: 400 }
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const subjectKey = `${hospitalCode}:${phone}`
  const mockOtpAllowed = isMockPhoneOtpAllowed()

  if (!mockOtpAllowed) {
    const [ipLimit, subjectLimit] = await Promise.all([
      rateLimitOtpRequestByIp(ip),
      rateLimitOtpRequestBySubject(subjectKey),
    ])

    if (!ipLimit.success) {
      return NextResponse.json({ error: ipLimit.error }, { status: 429 })
    }

    if (!subjectLimit.success) {
      return NextResponse.json({ error: subjectLimit.error }, { status: 429 })
    }
  }

  const svcSupabase = createAdminClient()
  const lookup = await findStaffLoginContext(svcSupabase, { phone, hospitalCode })
  if (lookup.error) {
    if (lookup.error.code === 'LOOKUP_FAILED') {
      logger.error('[OTP:request] Staff login lookup failed', {
        hospitalCode,
        phone: maskPhone(phone),
      })
      return NextResponse.json(
        { error: 'Failed to verify staff access. Please try again.' },
        { status: 500 }
      )
    }

    logger.warn('[OTP:request] Staff login lookup rejected', {
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

  const { hospital } = lookup.context
  const phoneOtpEnabled = isLivePhoneOtpEnabled()

  if (mockOtpAllowed) {
    logger.info('[OTP:request] MOCK MODE - no SMS sent', {
      phone: maskPhone(phone),
      hospitalCode,
      hospitalId: hospital.id,
    })
    return NextResponse.json({
      success: true,
      mode: 'mock',
      hint: 'Development stage: enter 000000 to verify.',
    })
  }

  if (!phoneOtpEnabled) {
    logger.error('[OTP:request] Phone OTP disabled in production-like environment.', {
      hospitalCode,
      hospitalId: hospital.id,
    })
    return NextResponse.json(
      { error: 'OTP login is temporarily unavailable. Contact your administrator.' },
      { status: 503 }
    )
  }

  const { error: otpError } = await svcSupabase.auth.signInWithOtp({
    phone,
    options: { channel: 'sms' },
  })

  if (otpError) {
    logger.error('[OTP:request] GoTrue OTP dispatch error', { error: otpError.message })
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
  }

  logger.info('[OTP:request] OTP dispatched', {
    phone: maskPhone(phone),
    hospitalCode,
  })

  return NextResponse.json({ success: true, mode: 'live' })
}
