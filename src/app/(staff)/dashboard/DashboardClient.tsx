'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BellRing, Clock3, LogOut, Siren, Workflow } from 'lucide-react'
import { type RealtimeChannel, type RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { PageShell } from '@/components/layout/page-shell'
import { DataTable } from '@/components/dashboard/data-table'
import { type PublicComplaint, qualityColumns } from '@/components/dashboard/columns'
import { PhiDetailModal } from '@/components/dashboard/phi-detail-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MetricCard } from '@/components/ui/metric-card'
import { StatusBanner } from '@/components/ui/status-banner'
import {
  subscribeToBreaches,
  subscribeToComplaints,
  subscribeToNotifications,
  type BreachPayload,
  type NotificationPayload,
} from '@/lib/realtime-subscriptions'
import { createBrowserAuthClient } from '@/lib/supabase-client'
import { formatAppNotificationTime } from '@/lib/app-time'
import { resolveSeverityCorrectionPermission } from '@/components/dashboard/severity-correction'

type DashboardClientProps = {
  initialComplaints: PublicComplaint[]
  initialNotifications: NotificationPayload[]
  hospitalName: string | null
  userId: string
  role: string
  activeDepartmentId: string | null
}

const COMPLAINT_REFRESH_DEBOUNCE_MS = 350
const COMPLAINT_REFRESH_POLL_MS = 5000

function shortComplaintId(complaintId: string) {
  return complaintId.slice(0, 8).toUpperCase()
}

function sortNotifications(notifications: NotificationPayload[]) {
  return [...notifications].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  )
}

function buildAcknowledgeBanner(outcome: string | null, complaintId: string | null) {
  if (!outcome) {
    return null
  }

  const complaintLabel = complaintId ? `Complaint ${shortComplaintId(complaintId)}` : 'Complaint'

  switch (outcome) {
    case 'acknowledged':
      return {
        variant: 'success' as const,
        title: `${complaintLabel} acknowledged`,
        body: 'The primary escalation timer was cancelled and the notification was marked as read.',
      }
    case 'already_acknowledged':
    case 'already_read':
      return {
        variant: 'info' as const,
        title: `${complaintLabel} was already handled`,
        body: 'This secure link is now idempotent, so retrying it safely returns the current acknowledged state.',
      }
    default:
      return {
        variant: 'warning' as const,
        title: 'Acknowledgement status updated',
        body: 'The dashboard received a non-standard acknowledgement result. Refresh if you want to confirm the latest queue state.',
      }
  }
}

function buildRealtimeErrorMessage(status: string) {
  if (status === 'TIMED_OUT') {
    return 'Realtime feed timed out. Refresh the dashboard to resync pending escalations.'
  }

  return 'Realtime feed disconnected. Refresh the dashboard to resync pending escalations.'
}

export function DashboardClient({
  initialComplaints,
  initialNotifications,
  hospitalName,
  userId,
  role,
  activeDepartmentId,
}: DashboardClientProps) {
  const [complaints, setComplaints] = React.useState(initialComplaints)
  const [notifications, setNotifications] = React.useState(
    sortNotifications(initialNotifications)
  )
  const [selectedComplaintId, setSelectedComplaintId] = React.useState<string | null>(null)
  const [realtimeError, setRealtimeError] = React.useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [logoutError, setLogoutError] = React.useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setComplaints(initialComplaints)
  }, [initialComplaints])

  React.useEffect(() => {
    setNotifications(sortNotifications(initialNotifications))
  }, [initialNotifications])

  React.useEffect(() => {
    const supabase = createBrowserAuthClient()
    const scheduleComplaintRefresh = () => {
      if (refreshTimerRef.current) {
        return
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        router.refresh()
      }, COMPLAINT_REFRESH_DEBOUNCE_MS)
    }

    const scheduleVisibleComplaintRefresh = () => {
      if (document.visibilityState === 'visible') {
        scheduleComplaintRefresh()
      }
    }

    const pollInterval = window.setInterval(
      scheduleVisibleComplaintRefresh,
      COMPLAINT_REFRESH_POLL_MS
    )

    const handleNotificationChange = (
      payload: RealtimePostgresChangesPayload<NotificationPayload>
    ) => {
      const nextNotification = payload.new as NotificationPayload | null
      if (!nextNotification?.id) {
        return
      }

      setNotifications((current) => {
        const withoutCurrent = current.filter(
          (notification) => notification.id !== nextNotification.id
        )

        if (nextNotification.status !== 'pending') {
          return withoutCurrent
        }

        return sortNotifications([nextNotification, ...withoutCurrent])
      })
    }

    const handleBreach = (payload: { new: BreachPayload }) => {
      const complaintId = payload.new?.complaint_id
      if (!complaintId) {
        return
      }

      setComplaints((current) => {
        const complaintIndex = current.findIndex((complaint) => complaint.id === complaintId)
        if (complaintIndex === -1) {
          return current
        }

        const reordered = [...current]
        const complaint = {
          ...reordered[complaintIndex],
          status: 'escalated' as const,
        }

        reordered.splice(complaintIndex, 1)
        return [complaint, ...reordered]
      })
    }

    const complaintDepartmentFilter =
      role === 'department_manager' ? activeDepartmentId ?? undefined : undefined

    const bindStatus = (channel: RealtimeChannel) =>
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeError(null)
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeError(buildRealtimeErrorMessage(status))
        }
      })

    const complaintsChannel = subscribeToComplaints(
      supabase,
      scheduleComplaintRefresh,
      complaintDepartmentFilter
    )
    const notificationsChannel = subscribeToNotifications(
      supabase,
      handleNotificationChange,
      userId
    )
    const breachesChannel = subscribeToBreaches(supabase, handleBreach)

    bindStatus(complaintsChannel)
    bindStatus(notificationsChannel)
    bindStatus(breachesChannel)

    window.addEventListener('focus', scheduleComplaintRefresh)
    document.addEventListener('visibilitychange', scheduleVisibleComplaintRefresh)

    return () => {
      window.clearInterval(pollInterval)
      window.removeEventListener('focus', scheduleComplaintRefresh)
      document.removeEventListener('visibilitychange', scheduleVisibleComplaintRefresh)

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      void supabase.removeChannel(complaintsChannel)
      void supabase.removeChannel(notificationsChannel)
      void supabase.removeChannel(breachesChannel)
    }
  }, [activeDepartmentId, role, router, userId])

  const activeComplaints = complaints.filter(
    (complaint) =>
      complaint.status !== 'resolved' &&
      complaint.status !== 'capa_validated' &&
      complaint.status !== 'closed'
  ).length
  const escalatedComplaints = complaints.filter(
    (complaint) => complaint.status === 'escalated'
  ).length
  const acknowledgementBanner = buildAcknowledgeBanner(
    searchParams.get('ack'),
    searchParams.get('context')
  )
  const severityCorrectionPermission = resolveSeverityCorrectionPermission(role)

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Logout request failed.')
      }

      router.replace('/login')
      router.refresh()
    } catch {
      setLogoutError('Logout failed. Please try again.')
      setIsLoggingOut(false)
    }
  }

  return (
    <PageShell
      eyebrow="Staff Dashboard"
      title="Complaint operations"
      description={
        <>
          Work the live complaint queue, respond to pending escalations, and open PHI only
          when a case truly needs clinical detail.
          {hospitalName ? ` Current hospital scope: ${hospitalName}.` : ''}
        </>
      }
      actions={
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <Badge variant="outline" className="capitalize">
            Active role: {role.replace(/_/g, ' ')}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="size-4" />
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </Button>
        </div>
      }
    >
      {logoutError ? <StatusBanner variant="error">{logoutError}</StatusBanner> : null}

      {acknowledgementBanner ? (
        <StatusBanner
          variant={acknowledgementBanner.variant}
          title={acknowledgementBanner.title}
        >
          {acknowledgementBanner.body}
        </StatusBanner>
      ) : null}

      {realtimeError ? (
        <StatusBanner variant="warning" title="Realtime feed needs attention">
          {realtimeError}
        </StatusBanner>
      ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Open complaints"
            value={activeComplaints}
            icon={<Workflow className="size-5" />}
          />
          <MetricCard
            label="Pending escalation links"
            value={notifications.length}
            icon={<BellRing className="size-5" />}
            tone="warning"
          />
          <MetricCard
            label="Escalated complaints"
            value={escalatedComplaints}
            icon={<Siren className="size-5" />}
            tone="danger"
          />
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending escalations</CardTitle>
              <CardDescription>
                These are the current in-app secure links waiting for acknowledgement.
              </CardDescription>
            </div>
          </CardHeader>

          {notifications.length === 0 ? (
            <CardContent>
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center">
                <p className="text-sm font-medium">No pending escalation links.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New escalation notifications will appear here as soon as they are issued.
                </p>
              </div>
            </CardContent>
          ) : (
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-amber-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-amber-700">
                        Complaint {shortComplaintId(notification.complaint_id)}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Acknowledge this escalation to stop the primary timer and mark the
                        notification as handled.
                      </p>
                    </div>
                    <Clock3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Issued {formatAppNotificationTime(notification.created_at)}
                    </p>
                    <Button asChild size="sm">
                      <Link href={notification.deep_link ?? `/dashboard?context=${notification.complaint_id}`}>
                        Open escalation
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Complaint queue</CardTitle>
              <CardDescription>
                This table stays PHI-free until you explicitly open complaint details.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <DataTable
              columns={qualityColumns}
              data={complaints}
              onViewDetails={(complaintId) => setSelectedComplaintId(complaintId)}
              severityCorrectionPermission={severityCorrectionPermission}
            />
          </CardContent>
        </Card>

        <PhiDetailModal
          key={selectedComplaintId ?? 'closed'}
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
    </PageShell>
  )
}
