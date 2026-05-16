'use server';

/**
 * workflow.ts — Complaint State Machine Transitions
 * Sprint A.2 + A.3 Refactor
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.2] Added requireUser() from auth-guard.ts to transitionComplaintStatus.
 *         is_active check is now implicit — deactivated staff cannot transition states.
 *   [A.3] Removed @opentelemetry/api import and OTEL errorCounter setup.
 *         Replaced with no-op stub from telemetry.ts.
 *
 * NOTE: transitionComplaintStatus previously had NO auth check. Any caller
 *       (including unauthenticated) could advance complaint state machine.
 *       requireUser() closes that gap.
 */

import { requireUser, createAuthenticatedClient, AuthError } from '@/lib/auth-guard';
import { logSecurityEvent } from '@/actions/audit';
import { WORKFLOW_STATES, ComplaintStatus } from '@/actions/workflow.types';
import * as Sentry from '@sentry/nextjs';
import { serverActionErrorCounter } from '@/lib/telemetry'

// Re-export for consumers that import from workflow.ts directly
export type { ComplaintStatus } from '@/actions/workflow.types';

/**
 * Validates if a requested status transition is legally permitted
 * by the StayAssist v4.1 state machine rules.
 */
function isValidTransition(current: ComplaintStatus, next: ComplaintStatus): boolean {
    const currentIndex = WORKFLOW_STATES.indexOf(current);
    const nextIndex = WORKFLOW_STATES.indexOf(next);

    // You can only move forward, and only one step at a time
    // EXCEPT: you can jump straight to 'closed' from 'resolved' if CAPA is not needed
    if (current === 'resolved' && next === 'closed') return true;

    return nextIndex === currentIndex + 1;
}

/**
 * Advances a complaint's status if the transition is valid.
 */
export async function transitionComplaintStatus(
    complaintId: string,
    nextStatus: ComplaintStatus
) {
    // [A.2] Auth guard — session + is_active check (was missing pre-sprint)
    try {
        await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createAuthenticatedClient()

    // 1. Fetch current status
    const { data: complaint, error: fetchError } = await supabase
        .from('complaints')
        .select('status')
        .eq('id', complaintId)
        .single();

    if (fetchError || !complaint) {
        serverActionErrorCounter.add(1, { action: 'transitionComplaintStatus', reason: 'NotFound' });
        throw new Error('Complaint not found.');
    }

    const currentStatus = complaint.status as ComplaintStatus;

    // 2. Validate strict state machine transition
    if (!isValidTransition(currentStatus, nextStatus)) {
        // SECURITY CONSTRAINT: Invalid transitions log to the ledger
        await logSecurityEvent({
            action: 'INVALID_STATE_TRANSITION',
            resource_id: complaintId,
            details: { currentStatus, nextStatus, error: 'Transition violates state machine' }
        });

        serverActionErrorCounter.add(1, { action: 'transitionComplaintStatus', reason: 'InvalidStateTransition' });
        const err = new Error(`Invalid Status Transition: Cannot move from ${currentStatus} to ${nextStatus}`);
        Sentry.captureException(err);
        throw err;
    }

    // 3. Effectuate transition
    const { error: updateError } = await supabase
        .from('complaints')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', complaintId);

    if (updateError) {
        serverActionErrorCounter.add(1, { action: 'transitionComplaintStatus', reason: 'DatabaseError' });
        Sentry.captureException(updateError);
        throw new Error(`Database error during transition: ${updateError.message}`);
    }

    // Log successful transition
    await logSecurityEvent({
        action: 'STATE_TRANSITION',
        resource_id: complaintId,
        details: { from: currentStatus, to: nextStatus }
    });

    // 4. Workflow side effects
    // Acknowledgement cancels the pending acknowledgement SLA timer; resolution is
    // kept as its own event for reporting/materialized-view refresh semantics.
    if (currentStatus === 'submitted' && nextStatus !== 'submitted') {
        const { inngest } = await import('@/inngest/client');
        await inngest.send({
            name: 'complaint/acknowledged',
            data: { complaintId }
        });
    }
    if (nextStatus === 'resolved') {
        const { inngest } = await import('@/inngest/client');
        await inngest.send({
            name: 'complaint/resolved',
            data: { complaintId }
        });
    }

    return { success: true, currentStatus: nextStatus };
}
