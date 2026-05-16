import { logger } from "@/lib/logger";
import {
    buildEscalationNotification,
    escalatePrimaryAcknowledgementBreach,
    reconcileOverdueAcknowledgementBreaches,
    unwrapEscalationResult,
} from "@/lib/sla-reconciliation";
import { createAdminClient } from "@/lib/supabase-admin";
import { inngestQueueDepthCounter, slaBreachCounter } from "@/lib/telemetry";
import { inngest } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * inngest/functions.ts â€” Background Job Definitions
 * Sprint A.3 â€” OpenTelemetry Stripped for V1
 */

function createServiceClient() {
    return createAdminClient();
}

async function loadComplaintRouting(
    supabase: SupabaseClient,
    complaintId: string
) {
    const { data, error } = await supabase
        .from("complaints")
        .select("status, department_id, hospital_id")
        .eq("id", complaintId)
        .single();

    if (error || !data) {
        return null;
    }

    return data;
}

/**
 * SLA Engine: Event-Driven Background Function
 * Watches a complaint and executes an escalation path if it remains unacknowledged
 * past its dynamically calculated Service Level Agreement limit.
 */
export const scheduleSlaBreach = inngest.createFunction(
    {
        id: "schedule-sla-breach",
        triggers: { event: "complaint/submitted" },
        cancelOn: [
            {
                event: "complaint/acknowledged",
                match: "data.complaintId",
            },
        ],
    },
    async ({ event, step }) => {
        const { complaintId, patientId: _p, clinicalSlaMinutes } = event.data;
        void _p;

        inngestQueueDepthCounter.add(-1, { queue: "clinical_sla_engine" });
        await step.sleep("wait-for-sla", `${clinicalSlaMinutes}m`);

        const isUnresolved = await step.run("verify-complaint-status", async () => {
            const supabase = createServiceClient();
            const complaint = await loadComplaintRouting(supabase, complaintId);
            return complaint?.status === "submitted";
        });

        if (isUnresolved) {
            await step.run("escalate-complaint", async () => {
                const supabase = createServiceClient();
                const complaint = await loadComplaintRouting(supabase, complaintId);

                if (!complaint || complaint.status !== "submitted") {
                    return;
                }

                const escalation = await escalatePrimaryAcknowledgementBreach(supabase, {
                    complaintId,
                    clinicalSlaMinutes,
                });
                if (!escalation || ["missing", "noop"].includes(escalation.outcome)) {
                    return;
                }

                slaBreachCounter.add(1, { escalation_level: "primary" });

                if (!escalation.recipient_id) {
                    logger.warn("[SLA Engine] No primary on-call recipient found", {
                        complaintId,
                        hospitalId: complaint.hospital_id,
                        departmentId: complaint.department_id,
                    });
                }
            });

            const latestComplaint = await step.run("confirm-escalated-state", async () => {
                const supabase = createServiceClient();
                const complaint = await loadComplaintRouting(supabase, complaintId);
                return complaint?.status === "escalated";
            });

            if (latestComplaint) {
                await step.sendEvent("trigger-secondary-escalation", {
                    name: "complaint/escalated",
                    data: { complaintId },
                });
                return { escalated: true, complaintId };
            }
        }

        return { escalated: false, complaintId };
    }
);

/**
 * SLA Safety Net: catches overdue submitted complaints if the original
 * complaint/submitted timer event was missed or the worker was offline.
 */
export const slaBreachReconciliation = inngest.createFunction(
    { id: "sla-breach-reconciliation", triggers: { cron: "*/5 * * * *" } },
    async ({ step }) => {
        const summary = await step.run("scan-overdue-acknowledgement-breaches", async () => {
            const supabase = createServiceClient();
            return reconcileOverdueAcknowledgementBreaches(supabase, { limit: 100 });
        });

        const escalatedEvents = summary.results
            .filter((result) =>
                result.outcome === "escalated" || result.outcome === "escalated_unassigned"
            )
            .map((result) => ({
                name: "complaint/escalated" as const,
                data: { complaintId: result.complaintId },
            }));

        if (escalatedEvents.length > 0) {
            await step.sendEvent("trigger-secondary-escalations", escalatedEvents);
        }

        if (summary.errors > 0) {
            logger.warn("[SLA Reconciliation] Some overdue complaints failed to escalate", {
                errors: summary.errors,
                scanned: summary.scanned,
            });
        }

        return summary;
    }
);

/**
 * 15-Minute Wake-Up Protocol: Secondary Escalation
 * Fires after the primary SLA breach, waiting exactly 15 minutes before enforcing a secondary escalation.
 */
export const escalationWakeUp = inngest.createFunction(
    {
        id: "escalation-wake-up",
        triggers: { event: "complaint/escalated" },
        cancelOn: [
            {
                event: "complaint/notification_read",
                match: "data.complaintId",
            },
        ],
    },
    async ({ event, step }) => {
        const { complaintId } = event.data;

        await step.sleep("wait-for-secondary-escalation", "15m");

        const routing = await step.run("verify-post-escalation-status", async () => {
            const supabase = createServiceClient();
            const complaint = await loadComplaintRouting(supabase, complaintId);
            return complaint?.status === "escalated" ? complaint : null;
        });

        if (routing) {
            await step.run("secondary-escalate", async () => {
                const supabase = createServiceClient();
                const notification = buildEscalationNotification({
                    complaintId,
                    escalated: true,
                });
                const { data, error } = await supabase.rpc(
                    "escalate_secondary_acknowledgement_breach",
                    {
                        p_complaint_id: complaintId,
                        p_secure_link_id: notification.secureLinkId,
                        p_deep_link: notification.deepLink,
                    }
                );

                if (error) {
                    throw new Error(`Secondary escalation failed: ${error.message}`);
                }

                const escalation = unwrapEscalationResult(data);
                if (!escalation || ["missing", "noop"].includes(escalation.outcome)) {
                    return;
                }

                if (!escalation.recipient_id) {
                    logger.warn("[SLA Engine] No secondary on-call recipient found", {
                        complaintId,
                        hospitalId: routing.hospital_id,
                        departmentId: routing.department_id,
                    });
                }
            });
        }
    }
);

/**
 * Refresh Materialised Views on Complaint Closure or SLA Breach
 * Concurrently refreshes all 8 analytics views without locking reads.
 */
export const refreshMaterializedViewsOnEvent = inngest.createFunction(
    {
        id: "refresh-materialized-views",
        triggers: [
            { event: "complaint/closed" },
            { event: "complaint/resolved" },
            { event: "complaint/escalated" },
            { event: "complaint/sla_breached" },
        ],
    },
    async ({ step }) => {
        await step.run("refresh-views", async () => {
            const supabase = createServiceClient();
            const { error } = await supabase.rpc("refresh_materialized_views");
            if (error) throw new Error(`Materialised View Refresh Failed: ${error.message}`);
            return { refreshed: true, timestamp: new Date().toISOString() };
        });
    }
);

/**
 * Nightly Materialised View Refresh & Compliance Audit
 * Runs at 02:30 IST every night.
 */
export const nightlyComplianceAudit = inngest.createFunction(
    { id: "nightly-compliance-audit", triggers: { cron: "TZ=Asia/Kolkata 30 2 * * *" } },
    async ({ step }) => {
        await step.run("nightly-refresh-views", async () => {
            const supabase = createServiceClient();
            const { error } = await supabase.rpc("refresh_materialized_views");
            if (error) throw new Error(`Nightly View Refresh Failed: ${error.message}`);
            return { refreshed: true };
        });

        await step.run("identify-anomalies", async () => {
            const supabase = createServiceClient();

            const timestamp = new Date().toISOString();
            const { error: anomalyError } = await supabase.rpc("detect_compliance_anomalies");

            if (anomalyError) {
                logger.error("[ComplianceAudit] Anomaly detection failed", {
                    error: anomalyError.message,
                });
                throw anomalyError;
            }

            return { audited: true, date: timestamp };
        });
    }
);

/**
 * 30-Day CAPA Checkpoint
 * Triggered exactly 30 days after both signatures are applied (capa_validated).
 * Requires the Quality Coordinator to review if the implemented fix actually worked.
 */
export const capa30DayCheckpoint = inngest.createFunction(
    { id: "capa-30-day-checkpoint", triggers: { event: "capa/validated" } },
    async ({ event, step }) => {
        await step.sleep("wait-30-days", "30d");

        await step.run("flag-for-qc-review", async () => {
            const supabase = createServiceClient();

            await supabase.from("audit_logs").insert({
                table_name: "complaints",
                record_id: event.data.complaintId,
                action_type: "UPDATE",
                new_data: {
                    event_type: "capa_review_required",
                    trigger: "30_day_checkpoint",
                    original_msd: event.data.msdId,
                    original_ms: event.data.msId,
                },
            });

            return { flagged: true, complaintId: event.data.complaintId };
        });
    }
);
