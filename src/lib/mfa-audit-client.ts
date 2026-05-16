import type { MFAAuditEvent } from '@/lib/mfa-audit-events'

export async function postMfaAuditEvent(
  eventType: MFAAuditEvent,
  metadata: Record<string, unknown> = {}
) {
  const response = await fetch('/api/auth/mfa/audit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    keepalive: true,
    body: JSON.stringify({ eventType, metadata }),
  })

  if (!response.ok) {
    throw new Error('Failed to record MFA audit event.')
  }

  return response.json() as Promise<{ success?: boolean; error?: string }>
}
