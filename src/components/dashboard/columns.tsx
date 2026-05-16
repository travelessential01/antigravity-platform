"use client"

/**
 * columns.tsx — Dashboard Complaint Table Column Definitions
 * Sprint A.4 + B.3 — Offline-Sync Removal & Server-Side Resolution
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.4] Removed useCrdtStore import and resolveComplaintLocally CRDT call.
 *         Removed offline-dependent resolution path.
 *   [B.3] Wired status-aware workflow buttons to Server Actions.
 *         Added loading state per complaint row.
 *         On success, calls router.refresh() to sync server state.
 */

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useSlaStore } from "@/store/useSlaStore"
import { acknowledgeComplaint, updateComplaintSeverity } from "@/actions/complaints"
import { transitionComplaintStatus, type ComplaintStatus } from "@/actions/workflow"
import { useRouter } from "next/navigation"
import { formatAppClockTime } from "@/lib/app-time"
import { Pencil, Loader2 } from "lucide-react"
import type { SeverityCorrectionPermission } from "@/components/dashboard/severity-correction"

// Extend TanStack Table meta to carry the PHI modal callback
declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData> {
        onViewDetails?: (complaintId: string) => void
        severityCorrectionPermission?: SeverityCorrectionPermission
    }
}

export type PublicComplaint = {
    id: string
    created_at: string
    updated_at?: string
    sla_deadline?: string // ISO timestamp; time_remaining_mins computed from this at fetch time
    severity: "high" | "critical" | "medium" | "low"
    time_remaining_mins: number | null
    location: string
    status:
        | "submitted"
        | "acknowledged"
        | "investigating"
        | "resolved"
        | "capa_validated"
        | "closed"
        | "escalated"
        | "pending" // legacy mock alias for 'submitted'
}

/**
 * SlaDeadlineCell — named component so useSlaStore hook triggers real re-renders.
 * Replaces the inline cell fn that called `getState()` (stale reads).
 */
function hasActiveAcknowledgementSla(status: PublicComplaint["status"]) {
    return status === "submitted" || status === "pending" || status === "escalated"
}

function SlaDeadlineCell({
    mins,
    status,
}: {
    mins: number | null
    status: PublicComplaint["status"]
}) {
    const ackHours = useSlaStore((s) => s.ackHours)
    if (!hasActiveAcknowledgementSla(status)) {
        if (status === "acknowledged") {
            return <div className="font-semibold text-emerald-600">Acknowledged</div>
        }
        if (status === "investigating") {
            return <div className="font-semibold text-sky-600">In progress</div>
        }
        return <div className="font-semibold text-slate-400">Completed</div>
    }

    if (mins === null) {
        return <div className="font-semibold text-slate-400">SLA pending</div>
    }

    const isCritical = mins <= ackHours * 60 * 0.2
    return (
        <div className={`font-semibold ${isCritical ? "text-red-600" : "text-slate-700"}`}>
            {mins} mins remaining
        </div>
    )
}

const SEVERITY_OPTIONS: Array<PublicComplaint["severity"]> = [
    "critical",
    "high",
    "medium",
    "low",
]

const SEVERITY_RANK: Record<PublicComplaint["severity"], number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
}

function getAllowedSeverityOptions(
    currentSeverity: PublicComplaint["severity"],
    correctionPermission: SeverityCorrectionPermission
) {
    if (correctionPermission === "full") {
        return SEVERITY_OPTIONS
    }

    if (correctionPermission === "increase_only") {
        return SEVERITY_OPTIONS.filter(
            (severity) => SEVERITY_RANK[severity] >= SEVERITY_RANK[currentSeverity]
        )
    }

    return []
}

function SeverityBadge({ severity }: { severity: PublicComplaint["severity"] }) {
    return (
        <Badge
            variant={severity === "high" || severity === "critical" ? "destructive" : "secondary"}
            className="capitalize"
        >
            {severity}
        </Badge>
    )
}

function SeverityCell({
    complaint,
    correctionPermission,
}: {
    complaint: PublicComplaint
    correctionPermission: SeverityCorrectionPermission
}) {
    const router = useRouter()
    const [open, setOpen] = React.useState(false)
    const [selectedSeverity, setSelectedSeverity] =
        React.useState<PublicComplaint["severity"]>(complaint.severity)
    const [reason, setReason] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    const [isPending, setIsPending] = React.useState(false)
    const allowedSeverityOptions = React.useMemo(
        () => getAllowedSeverityOptions(complaint.severity, correctionPermission),
        [complaint.severity, correctionPermission]
    )
    const hasEditableSeverityOption = allowedSeverityOptions.some(
        (severity) => severity !== complaint.severity
    )
    const correctionLabel =
        correctionPermission === "increase_only" ? "Increase severity" : "Change severity"

    React.useEffect(() => {
        if (!open) {
            setSelectedSeverity(complaint.severity)
            setReason("")
            setError(null)
        }
    }, [complaint.severity, open])

    if (!hasEditableSeverityOption) {
        return <SeverityBadge severity={complaint.severity} />
    }

    const handleSave = async () => {
        if (isPending) return

        setIsPending(true)
        setError(null)
        try {
            const result = await updateComplaintSeverity({
                complaintId: complaint.id,
                severity: selectedSeverity,
                reason,
            })

            if (result.success) {
                setOpen(false)
                router.refresh()
            } else {
                setError(result.error ?? "Severity update failed.")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Severity update failed.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <SeverityBadge severity={complaint.severity} />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        title={correctionLabel}
                        aria-label={correctionLabel}
                    >
                        <Pencil className="size-3" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{correctionLabel}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor={`severity-${complaint.id}`} className="text-sm font-medium">
                                Severity
                            </label>
                            <select
                                id={`severity-${complaint.id}`}
                                value={selectedSeverity}
                                onChange={(event) =>
                                    setSelectedSeverity(event.target.value as PublicComplaint["severity"])
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                                {allowedSeverityOptions.map((severity) => (
                                    <option key={severity} value={severity}>
                                        {severity}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor={`severity-reason-${complaint.id}`} className="text-sm font-medium">
                                Reason
                            </label>
                            <Textarea
                                id={`severity-reason-${complaint.id}`}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={500}
                                placeholder="Document the clinical or operational reason..."
                            />
                        </div>
                        {error && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={
                                isPending ||
                                selectedSeverity === complaint.severity ||
                                reason.trim().length < 5
                            }
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Saving
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

/**
 * WorkflowActionButton — advances the complaint through the allowed lifecycle.
 * Fresh complaints must be acknowledged before investigation or resolution.
 */
function WorkflowActionButton({ complaint }: { complaint: PublicComplaint }) {
    const router = useRouter()
    const [isPending, setIsPending] = React.useState(false)

    const normalizedStatus = complaint.status === "pending" ? "submitted" : complaint.status
    const action =
        normalizedStatus === "submitted" || normalizedStatus === "escalated"
            ? {
                label: "Acknowledge",
                pendingLabel: "Acknowledging...",
                className: normalizedStatus === "escalated"
                    ? "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
                run: () => acknowledgeComplaint({ complaintId: complaint.id }),
            }
            : normalizedStatus === "acknowledged"
                ? {
                    label: "Start Investigation",
                    pendingLabel: "Starting...",
                    className: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
                    run: () => transitionComplaintStatus(
                        complaint.id,
                        "investigating" satisfies ComplaintStatus
                    ),
                }
                : normalizedStatus === "investigating"
                    ? {
                        label: "Resolve",
                        pendingLabel: "Resolving...",
                        className: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
                        run: () => transitionComplaintStatus(
                            complaint.id,
                            "resolved" satisfies ComplaintStatus
                        ),
                    }
                    : null

    const handleAction = async () => {
        if (!action || isPending) return
        setIsPending(true)
        try {
            const result = await action.run()
            if (result.success) {
                router.refresh()
            } else {
                console.error("[WorkflowActionButton] Server action failed:", result.error)
            }
        } catch (err) {
            console.error("[WorkflowActionButton] Unexpected error:", err)
        } finally {
            setIsPending(false)
        }
    }

    if (!action) {
        return (
            <button
                disabled
                className="px-3 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
            >
                Completed
            </button>
        )
    }

    return (
        <button
            id={`workflow-btn-${complaint.id}`}
            onClick={handleAction}
            disabled={isPending}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isPending ? "bg-indigo-400 text-white cursor-wait" : action.className
            }`}
        >
            {isPending ? action.pendingLabel : action.label}
        </button>
    )
}

export const qualityColumns: ColumnDef<PublicComplaint>[] = [
    {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
            <div className="font-mono text-slate-500 uppercase">{row.getValue("id") as string}</div>
        ),
    },
    {
        accessorKey: "created_at",
        header: "Time Logged",
        cell: ({ row }) => {
            const dateStr = row.getValue("created_at") as string
            return (
                <div className="text-slate-600">
                    {formatAppClockTime(dateStr)}
                </div>
            )
        },
    },
    {
        accessorKey: "location",
        header: "Zone/Department",
    },
    {
        accessorKey: "severity",
        header: "SLA Severity",
        cell: ({ row, table }) => {
            return (
                <SeverityCell
                    complaint={row.original}
                    correctionPermission={
                        table.options.meta?.severityCorrectionPermission ?? "none"
                    }
                />
            )
        },
    },
    {
        accessorKey: "time_remaining_mins",
        header: "SLA Deadline",
        cell: ({ row }) => (
            <SlaDeadlineCell
                mins={row.getValue("time_remaining_mins") as number | null}
                status={row.original.status}
            />
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <span className={`capitalize font-medium ${status === "resolved" ? "text-emerald-600" : "text-amber-600"}`}>
                    {status}
                </span>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row, table }) => {
            const complaint = row.original
            const onViewDetails = table.options.meta?.onViewDetails

            return (
                <div className="flex items-center gap-2">
                    {/* View Details — opens PHI modal */}
                    <button
                        onClick={() => onViewDetails?.(complaint.id)}
                        className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 border border-slate-200"
                    >
                        View Details
                    </button>

                    <WorkflowActionButton complaint={complaint} />
                </div>
            )
        },
    },
]
