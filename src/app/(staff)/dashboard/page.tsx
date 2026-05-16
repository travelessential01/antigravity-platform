import { redirect } from 'next/navigation'
import type { NotificationPayload } from '@/lib/realtime-subscriptions'
import { AuthError, type AuthenticatedUser, requireUser } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { reconcileOverdueAcknowledgementBreaches } from '@/lib/sla-reconciliation'
import type { PublicComplaint } from '@/components/dashboard/columns'
import { DashboardClient } from './DashboardClient'
import {
  calculateSlaDeadline,
  normalizeComplaintSeverity,
  resolveAcknowledgementHours,
  type SlaConfiguration,
} from '@/lib/sla-deadline'

export const dynamic = 'force-dynamic'

type ComplaintQueryRow = {
  id: string
  hospital_id: string
  department_id: string
  created_at: string
  updated_at: string
  status: PublicComplaint['status']
  severity_level: PublicComplaint['severity'] | null
  sla_deadline: string | null
  departments: { name: string } | Array<{ name: string }> | null
}

function toDepartmentName(
  departments: ComplaintQueryRow['departments']
) {
  if (Array.isArray(departments)) {
    return departments[0]?.name ?? 'Unassigned'
  }

  return departments?.name ?? 'Unassigned'
}

function toRemainingMinutes(slaDeadline: string | null) {
  if (!slaDeadline) {
    return null
  }

  const deadlineMs = Date.parse(slaDeadline)
  if (!Number.isFinite(deadlineMs)) {
    return null
  }

  const diffMs = deadlineMs - Date.now()
  return Math.max(0, Math.ceil(diffMs / 60000))
}

function resolveDashboardSlaDeadline(row: ComplaintQueryRow, configurations: SlaConfiguration[]) {
  if (row.sla_deadline) {
    return row.sla_deadline
  }

  const severity = normalizeComplaintSeverity(row.severity_level)
  const acknowledgementHours = resolveAcknowledgementHours(configurations, {
    hospitalId: row.hospital_id,
    departmentId: row.department_id,
    severity,
  })

  return calculateSlaDeadline(row.created_at, acknowledgementHours)
}

function toPublicComplaint(
  row: ComplaintQueryRow,
  configurations: SlaConfiguration[]
): PublicComplaint {
  const slaDeadline = resolveDashboardSlaDeadline(row, configurations)

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sla_deadline: slaDeadline ?? undefined,
    severity: normalizeComplaintSeverity(row.severity_level),
    time_remaining_mins: toRemainingMinutes(slaDeadline),
    location: toDepartmentName(row.departments),
    status: row.status,
  }
}

async function fetchSlaConfigurations(rows: ComplaintQueryRow[]) {
  const hospitalIds = Array.from(new Set(rows.map((row) => row.hospital_id)))
  if (hospitalIds.length === 0) {
    return [] satisfies SlaConfiguration[]
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sla_configurations')
    .select('hospital_id, department_id, severity_level, max_acknowledgement_hours')
    .in('hospital_id', hospitalIds)
    .is('deleted_at', null)

  if (error || !data) {
    return [] satisfies SlaConfiguration[]
  }

  return data as SlaConfiguration[]
}

async function fetchComplaints(user: AuthenticatedUser) {
  const supabase = createAdminClient()
  let query = supabase
    .from('complaints')
    .select('id, hospital_id, department_id, created_at, updated_at, status, severity_level, sla_deadline, departments(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (user.role === 'department_manager') {
    if (!user.activeDepartmentId) {
      return [] satisfies PublicComplaint[]
    }

    query = query.eq('department_id', user.activeDepartmentId)
  } else if (user.role !== 'dpo') {
    if (!user.hospitalId) {
      return [] satisfies PublicComplaint[]
    }

    query = query.eq('hospital_id', user.hospitalId)
  }

  const { data, error } = await query
  if (error || !data) {
    return [] satisfies PublicComplaint[]
  }

  const rows = data as ComplaintQueryRow[]
  const configurations = await fetchSlaConfigurations(rows)
  return rows.map((row) => toPublicComplaint(row, configurations))
}

async function fetchPendingNotifications(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, recipient_id, complaint_id, channel, deep_link, status, created_at, delivered_at, read_at')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(6)

  if (error || !data) {
    return [] satisfies NotificationPayload[]
  }

  return data as NotificationPayload[]
}

async function reconcilePendingEscalationsForDashboard(user: AuthenticatedUser) {
  if (user.role === 'department_manager' && !user.activeDepartmentId) {
    return
  }

  if (user.role !== 'dpo' && !user.hospitalId) {
    return
  }

  const supabase = createAdminClient()

  try {
    const summary = await reconcileOverdueAcknowledgementBreaches(supabase, {
      limit: 100,
      hospitalId: user.role === 'dpo' ? null : user.hospitalId,
      departmentId: user.role === 'department_manager' ? user.activeDepartmentId : null,
    })

    if (summary.errors > 0) {
      await logger.warn('[Dashboard] SLA reconciliation completed with errors.', {
        scanned: summary.scanned,
        escalated: summary.escalated,
        errors: summary.errors,
      })
    }
  } catch (error) {
    await logger.warn('[Dashboard] SLA reconciliation failed before dashboard load.', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function fetchHospitalName(hospitalId: string | null) {
  if (!hospitalId) {
    return null
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('hospitals')
    .select('name')
    .eq('id', hospitalId)
    .maybeSingle()

  return data?.name ?? null
}

export default async function DashboardPage() {
  let user: AuthenticatedUser

  try {
    user = await requireUser()
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'UNAUTHORIZED') redirect('/login')
      if (error.code === 'DEACTIVATED') redirect('/login?error=deactivated')
      if (error.code === 'MFA_REQUIRED') redirect('/auth/mfa/challenge')
    }

    redirect('/login')
  }

  if (user.staffType === 'float' && !user.activeDepartmentId) {
    redirect('/select-department')
  }

  await reconcilePendingEscalationsForDashboard(user)

  const [initialComplaints, initialNotifications, hospitalName] = await Promise.all([
    fetchComplaints(user),
    fetchPendingNotifications(user.id),
    fetchHospitalName(user.hospitalId),
  ])

  return (
    <DashboardClient
      initialComplaints={initialComplaints}
      initialNotifications={initialNotifications}
      hospitalName={hospitalName}
      userId={user.id}
      role={user.role}
      activeDepartmentId={user.activeDepartmentId}
    />
  )
}
