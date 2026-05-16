import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { testDataPrefix } from './env'

export type AcknowledgeFixture = {
  complaintId: string
  hospitalId: string
  departmentId: string
  patientId: string
  recipientId: string
  secureLinkId: string
  notificationId: string
  cleanup: () => Promise<void>
}

export async function createAcknowledgeFixture(
  supabase: SupabaseClient,
  input: { secureLinkId: string; token: string }
): Promise<AcknowledgeFixture> {
  const prefix = testDataPrefix()

  const { data: department, error: departmentError } = await supabase
    .from('departments')
    .select('id, hospital_id')
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (departmentError || !department) {
    throw new Error(`No department fixture available: ${departmentError?.message ?? 'missing row'}`)
  }

  const hospitalId = department.hospital_id as string
  const departmentId = department.id as string

  const { data: recipient, error: recipientError } = await supabase
    .from('users')
    .select('id')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (recipientError || !recipient) {
    throw new Error(`No active staff fixture available: ${recipientError?.message ?? 'missing row'}`)
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({
      hospital_id: hospitalId,
      contact_hash: `${prefix}:patient:${crypto.randomUUID()}`,
    })
    .select('id')
    .single()

  if (patientError || !patient) {
    throw new Error(`Failed to create test patient: ${patientError?.message ?? 'missing row'}`)
  }

  const complaintId = crypto.randomUUID()
  const { error: complaintError } = await supabase
    .from('complaints')
    .insert({
      id: complaintId,
      hospital_id: hospitalId,
      department_id: departmentId,
      patient_id: patient.id,
      status: 'submitted',
      severity_level: 'high',
    })

  if (complaintError) {
    throw new Error(`Failed to create test complaint: ${complaintError.message}`)
  }

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      recipient_id: recipient.id,
      complaint_id: complaintId,
      channel: 'in_app',
      secure_link_id: input.secureLinkId,
      deep_link: `/dashboard/escalations?context=${complaintId}&token=${encodeURIComponent(input.token)}`,
      status: 'pending',
    })
    .select('id')
    .single()

  if (notificationError || !notification) {
    throw new Error(`Failed to create test notification: ${notificationError?.message ?? 'missing row'}`)
  }

  async function bestEffort<T>(operation: Promise<T>) {
    try {
      await operation
    } catch {
      // Cleanup should not hide the assertion that just ran. Several ledger
      // tables are intentionally immutable in hardened environments.
    }
  }

  return {
    complaintId,
    hospitalId,
    departmentId,
    patientId: patient.id as string,
    recipientId: recipient.id as string,
    secureLinkId: input.secureLinkId,
    notificationId: notification.id as string,
    cleanup: async () => {
      await bestEffort(supabase.from('processed_events').delete().like('event_id', `%${complaintId}%`))
      await bestEffort(supabase.from('notifications').delete().eq('complaint_id', complaintId))
      await bestEffort(supabase.from('complaint_status_history').delete().eq('complaint_id', complaintId))
      await bestEffort(supabase.from('sla_breach_log').delete().eq('complaint_id', complaintId))
      await bestEffort(supabase.from('complaint_phi').delete().eq('complaint_id', complaintId))
      await bestEffort(supabase.from('complaints').delete().eq('id', complaintId))
      await bestEffort(supabase.from('patients').delete().eq('id', patient.id))
    },
  }
}
