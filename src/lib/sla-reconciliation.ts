import { createAcknowledgeToken } from "@/lib/acknowledgement-links";

import type { SupabaseClient } from "@supabase/supabase-js";

export type EscalationOutcome =
    | "escalated"
    | "escalated_unassigned"
    | "secondary_escalated"
    | "secondary_unassigned"
    | "noop"
    | "missing";

export type EscalationRpcRow = {
    outcome: EscalationOutcome;
    recipient_id: string | null;
}

type OverdueComplaintRow = {
    id: string;
    created_at: string;
    sla_deadline: string | null;
}

export type AcknowledgementBreachReconciliationResult = {
    complaintId: string;
    clinicalSlaMinutes: number;
    outcome: EscalationOutcome | "error";
    recipientId: string | null;
    error?: string;
}

export function unwrapEscalationResult(data: unknown): EscalationRpcRow | null {
    if (Array.isArray(data)) {
        return (data[0] ?? null) as EscalationRpcRow | null;
    }

    return (data ?? null) as EscalationRpcRow | null;
}

export function buildEscalationNotification(input: { complaintId: string; escalated?: boolean }) {
    const secureLinkId = crypto.randomUUID();
    const token = createAcknowledgeToken({
        complaintId: input.complaintId,
        linkId: secureLinkId,
    });
    const deepLink =
        `/dashboard/escalations?context=${input.complaintId}` +
        `&token=${encodeURIComponent(token)}` +
        (input.escalated ? "&escalated=true" : "");

    return { secureLinkId, deepLink };
}

export function calculateAcknowledgementSlaMinutes(input: {
    createdAt: string;
    slaDeadline: string | null;
}) {
    const createdAtMs = Date.parse(input.createdAt);
    const deadlineMs = input.slaDeadline ? Date.parse(input.slaDeadline) : Number.NaN;

    if (!Number.isFinite(createdAtMs) || !Number.isFinite(deadlineMs)) {
        return 0;
    }

    return Math.max(0, Math.round((deadlineMs - createdAtMs) / 60_000));
}

export async function escalatePrimaryAcknowledgementBreach(
    supabase: SupabaseClient,
    input: {
        complaintId: string;
        clinicalSlaMinutes: number;
    }
) {
    const notification = buildEscalationNotification({ complaintId: input.complaintId });
    const { data, error } = await supabase.rpc(
        "escalate_primary_acknowledgement_breach",
        {
            p_complaint_id: input.complaintId,
            p_clinical_sla_minutes: input.clinicalSlaMinutes,
            p_secure_link_id: notification.secureLinkId,
            p_deep_link: notification.deepLink,
        }
    );

    if (error) {
        throw new Error(`Primary escalation failed: ${error.message}`);
    }

    return unwrapEscalationResult(data);
}

export async function reconcileOverdueAcknowledgementBreaches(
    supabase: SupabaseClient,
    input: {
        now?: Date;
        limit?: number;
        hospitalId?: string | null;
        departmentId?: string | null;
        complaintIds?: string[];
    } = {}
) {
    const now = input.now ?? new Date();
    const limit = input.limit ?? 100;

    let query = supabase
        .from("complaints")
        .select("id, created_at, sla_deadline")
        .eq("status", "submitted")
        .not("sla_deadline", "is", null)
        .lte("sla_deadline", now.toISOString())
        .order("sla_deadline", { ascending: true })
        .limit(limit);

    if (input.hospitalId) {
        query = query.eq("hospital_id", input.hospitalId);
    }

    if (input.departmentId) {
        query = query.eq("department_id", input.departmentId);
    }

    if (input.complaintIds?.length) {
        query = query.in("id", input.complaintIds);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Overdue complaint scan failed: ${error.message}`);
    }

    const complaints = (data ?? []) as OverdueComplaintRow[];
    const results: AcknowledgementBreachReconciliationResult[] = [];

    for (const complaint of complaints) {
        const clinicalSlaMinutes = calculateAcknowledgementSlaMinutes({
            createdAt: complaint.created_at,
            slaDeadline: complaint.sla_deadline,
        });

        try {
            const escalation = await escalatePrimaryAcknowledgementBreach(supabase, {
                complaintId: complaint.id,
                clinicalSlaMinutes,
            });

            if (!escalation) {
                results.push({
                    complaintId: complaint.id,
                    clinicalSlaMinutes,
                    outcome: "error",
                    recipientId: null,
                    error: "Primary escalation RPC returned no row.",
                });
                continue;
            }

            results.push({
                complaintId: complaint.id,
                clinicalSlaMinutes,
                outcome: escalation.outcome,
                recipientId: escalation.recipient_id,
            });
        } catch (error) {
            results.push({
                complaintId: complaint.id,
                clinicalSlaMinutes,
                outcome: "error",
                recipientId: null,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return {
        scanned: complaints.length,
        escalated: results.filter((result) =>
            result.outcome === "escalated" || result.outcome === "escalated_unassigned"
        ).length,
        errors: results.filter((result) => result.outcome === "error").length,
        results,
    };
}
