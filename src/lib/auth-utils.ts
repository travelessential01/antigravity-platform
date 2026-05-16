export function normalizeRoleName(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isLivePhoneOtpEnabled(): boolean {
  return process.env.SUPABASE_PHONE_OTP_ENABLED === 'true'
}

export function isMockPhoneOtpAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && !isLivePhoneOtpEnabled()
}

export function isMfaEnforcementPaused(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_MFA_PAUSED === 'true'
}
