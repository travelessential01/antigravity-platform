/**
 * logger.ts — Structured Logging Wrapper
 *
 * Provides a unified logging interface that:
 *   - Routes to Logtail (Better Stack) when LOGTAIL_SOURCE_TOKEN is configured
 *     AND @logtail/next is installed (run: pnpm add @logtail/next)
 *   - Falls back gracefully to structured console.* in all other cases
 *
 * Usage (drop-in replacement for bare console.*):
 *   import { logger } from '@/lib/logger';
 *   logger.error('[SLA Engine] No on-call manager found', { complaintId });
 *   logger.warn('[Dashboard] Fetch failed — using mock data');
 *   logger.info('[Realtime] Breach channel subscribed');
 */

import { formatAppTimestamp } from '@/lib/app-time';

type LogContext = Record<string, unknown>;

type LogLevel = 'info' | 'warn' | 'error';

async function send(level: LogLevel, message: string, ctx?: LogContext) {
    // Attempt Logtail only when token AND package are present
    if (process.env.LOGTAIL_SOURCE_TOKEN) {
        try {
            const mod = await import(/* webpackIgnore: true */ '@logtail/next' as string);
            const log = (mod as Record<string, Record<LogLevel, (m: string, c?: LogContext) => void>>).log;
            if (log?.[level]) {
                log[level](message, ctx);
                return;
            }
        } catch {
            // @logtail/next not installed — fall through to console silently
        }
    }

    // Default: structured console output (always available)
    const prefix = `[${formatAppTimestamp(new Date())}]`;
    console[level](prefix, message, ctx ?? '');
}

export const logger = {
    info:  (message: string, ctx?: LogContext) => send('info',  message, ctx),
    warn:  (message: string, ctx?: LogContext) => send('warn',  message, ctx),
    error: (message: string, ctx?: LogContext) => send('error', message, ctx),
};
