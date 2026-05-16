import type { MFAAuditEvent } from '@/lib/mfa-audit-events'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { serverActionErrorCounter } from '@/lib/telemetry'

export async function writeMfaAuditEvent(
  userId: string,
  eventType: MFAAuditEvent,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      table_name: 'users',
      record_id: userId,
      action_type: 'MFA_CHALLENGE',
      new_data: {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      performed_by: userId,
    })

  if (error) {
    logger.error('Failed to write MFA event to the audit ledger.', {
      error: error.message,
      eventType,
      actorId: userId,
    })
    serverActionErrorCounter.add(1, { action: 'logMFAEvent', reason: 'DatabaseError' })
    return { success: false, error: 'Database write failed' }
  }

  return { success: true }
}
