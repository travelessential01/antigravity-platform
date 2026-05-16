import * as Sentry from '@sentry/nextjs';

/**
 * instrumentation.ts — Next.js Instrumentation Hook
 * Sprint A.3 — OpenTelemetry Stripped for V1
 *
 * CHANGE FROM PRE-SPRINT:
 *   Removed dynamic import of './lib/otel-node-sdk' which bootstrapped the
 *   full OpenTelemetry NodeSDK (grpc exporters, native Node modules etc.).
 *   OTEL stack caused Webpack bundling conflicts with Next.js Edge/RSC context.
 *
 * Sentry initialization is retained — it uses the config files
 * (sentry.client.config.ts / sentry.server.config.ts) and does not have
 * native module conflicts.
 */
export async function register() {
    // [A.3] OTEL SDK import removed — otel-node-sdk.ts is deleted.
    // Telemetry no-ops in src/lib/telemetry.ts keep consumers compiling.

    // Sentry is auto-initialized via nextjs integration on import.
    // The if-block below is retained for future hooks (e.g., custom onStart logic).
    if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
        // Placeholder for future runtime-specific initialization
    }
}

export const onRequestError = Sentry.captureRequestError;
