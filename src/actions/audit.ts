'use server'

/**
 * audit.ts — Audit Server Actions
 * Sprint A.2 + A.3 Refactor
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.2] Replaced raw getSession() boilerplate in logMFAEvent with requireUser()
 *         from auth-guard.ts. is_active check is now implicit.
 *   [A.3] Removed @opentelemetry/api import and errorCounter OTEL usage.
 *         Replaced with no-op stub from telemetry.ts.
 */

import { requireUser, AuthError } from '@/lib/auth-guard'
import * as Sentry from '@sentry/nextjs';
import { serverActionErrorCounter } from '@/lib/telemetry'
import { logger } from '@/lib/logger'
import type { MFAAuditEvent } from '@/lib/mfa-audit-events'
import { writeMfaAuditEvent } from '@/lib/mfa-audit'
import { createAdminClient } from '@/lib/supabase-admin'

export async function logMFAEvent(eventType: MFAAuditEvent, metadata: Record<string, unknown> = {}) {
    // [A.2] Auth guard — replaces 18-line raw boilerplate
    let user
    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            logger.warn('Attempted to log MFA event without an active session or with a deactivated account.', {
                reason: error.code,
            })
            serverActionErrorCounter.add(1, { action: 'logMFAEvent', reason: error.code });
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized' }
    }

    const result = await writeMfaAuditEvent(user.id, eventType, metadata)
    if (!result.success) {
        Sentry.captureMessage(`MFA audit write failed for ${eventType}`)
    }

    return result
}

/**
 * Generic telemetry logger for system security constraints and state machine transitions.
 * Uses service-role — this is a system-level event logger, not a user-initiated action.
 */
export async function logSecurityEvent(payload: { action: string, resource_id: string, details?: Record<string, unknown> }) {
    const supabase = createAdminClient()

    await supabase.from('audit_logs').insert({
        table_name: 'complaints',
        record_id: payload.resource_id,
        action_type: 'UPDATE',
        new_data: {
            event_type: payload.action,
            timestamp: new Date().toISOString(),
            ...payload.details
        },
        performed_by: null,
    })
}
