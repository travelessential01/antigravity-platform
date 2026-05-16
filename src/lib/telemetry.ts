/**
 * telemetry.ts — Sentry Performance Metrics
 * Phase 3 — Replaces silent no-op stubs (Sprint A.3) with real Sentry metric calls.
 *
 * Uses @sentry/nextjs v10 metrics API: count(), distribution(), gauge()
 * All metrics visible at: Sentry Dashboard → Metrics → stayassist project
 *
 * Consumer files remain unchanged — same export shape as the previous no-ops.
 */

import * as Sentry from '@sentry/nextjs';

export function initTelemetry() {
    // Sentry initialised via instrumentation.ts — nothing additional needed.
}

/** Counts SLA policy breaches. Visible in Sentry Metrics as `sla.breach`. */
export const slaBreachCounter = {
    add: (value: number, attrs?: Record<string, unknown>) => {
        void attrs;
        Sentry.metrics.count('sla.breach', value);
    },
};

/** Counts server action failures. Visible as `server_action.error`. */
export const serverActionErrorCounter = {
    add: (value: number, attrs?: Record<string, unknown>) => {
        void attrs;
        Sentry.metrics.count('server_action.error', value);
    },
};

/** Counts immutable audit log writes. Visible as `audit.log_write`. */
export const auditLogIntegrityCounter = {
    add: (value: number, attrs?: Record<string, unknown>) => {
        void attrs;
        Sentry.metrics.count('audit.log_write', value);
    },
};

/**
 * Tracks Inngest queue depth changes.
 * Positive = job enqueued, Negative = job completed.
 * Visible as `inngest.queue_delta`.
 */
export const inngestQueueDepthCounter = {
    add: (value: number, attrs?: Record<string, unknown>) => {
        void attrs;
        Sentry.metrics.count('inngest.queue_delta', value);
    },
};

/**
 * Records PHI decryption latency in milliseconds.
 * Visible as `phi.decryption_latency_ms` distribution in Sentry.
 */
export const decryptionLatencyHistogram = {
    record: (value: number, attrs?: Record<string, unknown>) => {
        void attrs;
        Sentry.metrics.distribution('phi.decryption_latency_ms', value);
    },
};
