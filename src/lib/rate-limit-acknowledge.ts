/**
 * rate-limit-acknowledge.ts — Token Bucket Rate Limiter for Deep-Link Acknowledge Endpoint
 * Sprint A.1 — StayAssist V1 Hardening
 * Task 4.3 — Multi-Channel Notification Engine
 *
 * Redis Token Bucket: 5 requests per minute per IP address.
 * Uses a distinct key namespace (`ratelimit:acknowledge:`) separate from
 * the complaint-creation limiter (`ratelimit:complaint:`) in rate-limit.ts.
 *
 * CHANGE FROM PRE-SPRINT:
 *   - Redis now connects to dedicated `stayassist-redis` on port 6380 (was Authentik port 6379).
 *   - `lazyConnect: true` + `enableOfflineQueue: false` for fast fail.
 *   - Catch block retains FAIL-OPEN behaviour (deep-link is time-sensitive 15-min window).
 */

import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'

const LIMIT = 5
const WINDOW_SECONDS = 60

export async function rateLimitAcknowledge(
    ip: string
): Promise<{ success: boolean; error?: string; remaining?: number }> {
    try {
        const key = `ratelimit:acknowledge:${ip}`

        const pipeline = redis.pipeline()
        pipeline.incr(key)
        pipeline.ttl(key)
        const results = await pipeline.exec()

        if (!results) {
            return { success: false, error: 'Redis pipeline failed' }
        }

        const currentCount = results[0][1] as number
        const ttl = results[1][1] as number

        // Set expiry on first request or if missing (failsafe)
        if (currentCount === 1 || ttl === -1) {
            await redis.expire(key, WINDOW_SECONDS)
        }

        if (currentCount > LIMIT) {
            return {
                success: false,
                error: `Rate limit exceeded. Maximum ${LIMIT} acknowledge requests per minute.`,
                remaining: 0,
            }
        }

        return { success: true, remaining: LIMIT - currentCount }
    } catch (error) {
        // FAIL-OPEN: acknowledge deep-link is time-sensitive (15-min expiry window).
        // Log but allow through — local_audit_reads captures the event regardless.
        logger.error('[stayassist-redis] Acknowledge rate limiter unavailable; allowing request.', {
            error: error instanceof Error ? error.message : String(error),
        })
        return { success: true, remaining: -1 }
    }
}
