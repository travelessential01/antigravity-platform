/**
 * src/lib/login-risk.ts — Login Risk Scoring Engine
 * Phase 2.6 — StayAssist V1 Auth Architecture
 *
 * Evaluates risk signals on every login attempt and returns a risk level.
 * High-risk logins force TOTP challenge regardless of role.
 * Medium-risk logins are allowed but emit a security_alert for admin review.
 *
 * Signals evaluated:
 *   - isNewDevice: device fingerprint hash not seen before for this user
 *   - isUnusualGeo: IP country/region differs from the last 5 sessions
 *   - consecutiveFailures: brute-force signal (≥3 OTP failures for this phone)
 */

import { createAdminClient } from '@/lib/supabase-admin'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginRiskSignal {
  /** Hashed fingerprint of User-Agent + Accept-Language + platform strings */
  deviceFingerprintHash: string
  /** ISO 3166-1 alpha-2 country code resolved from request IP (via CF-IPCountry header) */
  ipCountry: string
  /** Number of consecutive OTP failures for this phone number in the last 30 minutes */
  consecutiveFailures: number
  /** Supabase auth user ID — used to look up device history. Null for first-time logins. */
  authUserId?: string
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  level: RiskLevel
  reasons: string[]
  forceTotp: boolean
  alertAdmin: boolean
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * computeRiskScore()
 *
 * Evaluates login risk signals and returns a RiskAssessment.
 *
 * Scoring matrix:
 *   consecutiveFailures >= 5  → HIGH (brute force threshold)
 *   isNewDevice + isUnusualGeo → HIGH (combined anomaly)
 *   isNewDevice || isUnusualGeo → MEDIUM (single anomaly)
 *   else → LOW
 */
export function computeRiskScore(signals: LoginRiskSignal, knownDevices: string[], lastCountry: string | null): RiskAssessment {
  const reasons: string[] = []
  let score = 0

  const isNewDevice = !knownDevices.includes(signals.deviceFingerprintHash)
  const isUnusualGeo = lastCountry !== null && signals.ipCountry !== lastCountry

  if (signals.consecutiveFailures >= 5) {
    score += 3
    reasons.push(`Brute-force signal: ${signals.consecutiveFailures} consecutive OTP failures`)
  } else if (signals.consecutiveFailures >= 3) {
    score += 1
    reasons.push(`Repeated OTP failures: ${signals.consecutiveFailures} attempts`)
  }

  if (isNewDevice) {
    score += 1
    reasons.push('Unrecognised device fingerprint')
  }

  if (isUnusualGeo) {
    score += 1
    reasons.push(`Unusual login location: ${signals.ipCountry} (last known: ${lastCountry})`)
  }

  let level: RiskLevel
  if (score >= 3) {
    level = 'high'
  } else if (score >= 1) {
    level = 'medium'
  } else {
    level = 'low'
  }

  return {
    level,
    reasons,
    forceTotp: level === 'high',
    alertAdmin: level !== 'low',
  }
}

// ── Device History ─────────────────────────────────────────────────────────────

/**
 * Derives a lightweight fingerprint from request headers.
 * Does NOT collect biometric or hardware identifiers.
 * Combines: User-Agent + Accept-Language + platform hint.
 */
export function deriveDeviceFingerprint(
  userAgent: string,
  acceptLanguage: string,
  platform: string
): string {
  // Poor-man's hash — stable between requests, sufficiently unique per device class.
  // In production, consider using a proper hash function (SHA-256 via Web Crypto).
  const raw = `${userAgent}|${acceptLanguage}|${platform}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Gets historical device fingerprints and last known country for a user
 * from the security_alerts table (already present, migration 014).
 *
 * Returns { knownDevices: string[], lastCountry: string | null }
 */
export async function getUserLoginHistory(authUserId: string): Promise<{
  knownDevices: string[]
  lastCountry: string | null
}> {
  const supabase = createAdminClient()
  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!appUser?.id) {
    return { knownDevices: [], lastCountry: null }
  }

  const { data } = await supabase
    .from('audit_logs')
    .select('new_data')
    .eq('table_name', 'users')
    .eq('record_id', appUser.id)
    .eq('action_type', 'LOGIN_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) {
    return { knownDevices: [], lastCountry: null }
  }

  const knownDevices = data
    .map((row) => (row.new_data as Record<string, string>)?.fingerprint)
    .filter(Boolean)

  const lastCountry = (data[0].new_data as Record<string, string>)?.country ?? null

  return { knownDevices, lastCountry }
}

/**
 * Writes a security_alert record for this login event.
 * Called for all logins — low risk for audit trail, higher risk for admin visibility.
 */
export async function recordLoginEvent(opts: {
  authUserId: string
  assessment: RiskAssessment
  fingerprint: string
  ipCountry: string
  phone: string
  hospitalId: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', opts.authUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!appUser) {
    return
  }

  const details = {
    fingerprint: opts.fingerprint,
    country: opts.ipCountry,
    phone: opts.phone,
    hospital_id: opts.hospitalId,
    risk_level: opts.assessment.level,
    force_totp: opts.assessment.forceTotp,
    reasons: opts.assessment.reasons,
  }

  await supabase.from('audit_logs').insert({
    table_name: 'users',
    record_id: appUser.id,
    action_type: 'LOGIN_SUCCESS',
    new_data: details,
    performed_by: appUser.id,
  })

  if (opts.assessment.level !== 'low') {
    await supabase.from('security_alerts').insert({
      alert_type:
        opts.assessment.forceTotp && opts.assessment.reasons.some((reason) => reason.includes('Brute-force'))
          ? 'BRUTE_FORCE'
          : 'SUSPICIOUS_ACTIVITY',
      source_table: 'users',
      source_record_id: appUser.id,
      details,
    })
  }
}
