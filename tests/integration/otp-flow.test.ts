import { describe, expect, test } from 'vitest'
import { appBaseUrl, env } from '../helpers/env'
import { isReachable, jsonPost, requestJson } from '../helpers/http'
import { canReachSupabase, createSupabaseAdmin, hasSupabaseCredentials } from '../helpers/supabase'

describe('OTP mock login integration', () => {
  test('mock OTP request and verify flow works when explicitly enabled', async () => {
    if (env('RUN_OTP_FLOW_TEST') !== 'true') {
      console.warn('Skipping OTP flow because RUN_OTP_FLOW_TEST=true is not set')
      return
    }

    const baseUrl = appBaseUrl()
    if (!await isReachable(`${baseUrl}/api/health`)) {
      console.warn(`Skipping OTP flow because ${baseUrl} is not reachable`)
      return
    }

    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping OTP flow because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const { data: staff, error } = await supabase
      .from('users')
      .select('phone, email, hospitals!inner(hospital_code)')
      .not('phone', 'is', null)
      .not('email', 'is', null)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    expect(error).toBeNull()
    if (!staff?.phone || !staff.hospitals?.hospital_code) {
      console.warn('Skipping OTP flow because no active staff with phone/email/hospital_code exists')
      return
    }

    const request = await requestJson(`${baseUrl}/api/auth/otp/request`, {
      ...jsonPost({ phone: staff.phone, hospitalCode: staff.hospitals.hospital_code }),
      expectedStatus: 200,
    })
    expect(request.body).toMatchObject({ success: true, mode: 'mock' })

    const verify = await requestJson<{ success?: boolean; nextAction?: string }>(`${baseUrl}/api/auth/otp/verify`, {
      ...jsonPost({ phone: staff.phone, hospitalCode: staff.hospitals.hospital_code, token: '000000' }),
      expectedStatus: 200,
    })

    expect(verify.body.success).toBe(true)
    expect(['post_login', 'totp', 'biometric', 'register']).toContain(verify.body.nextAction)
  })
})
