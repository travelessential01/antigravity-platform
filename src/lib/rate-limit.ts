/**
 * rate-limit.ts — Token Bucket Rate Limiter for Complaint Creation
 * Sprint A.1 — StayAssist V1 Hardening
 *
 * Rule: 2 complaints per intake identity per minute.
 *
 * CHANGE FROM PRE-SPRINT:
 *   - Redis now connects to dedicated `stayassist-redis` on port 6380 (was Authentik port 6379).
 *   - `lazyConnect: true` — no crash on startup if Redis is offline.
 *   - `enableOfflineQueue: false` — fail immediately instead of enqueuing commands.
 *   - Catch block is FAIL-OPEN: Redis unavailability does NOT block complaint submission.
 *     A structured error log is emitted so ops can detect the outage without impacting patients.
 */

import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'

// Custom Token Bucket rate limiting
// Rule: 2 complaints per intake identity per minute
export async function rateLimitComplaintCreation(identityKey: string): Promise<{ success: boolean; error?: string }> {
    try {
        const key = `ratelimit:complaint:${identityKey}`
        const limit = 2
        const windowSeconds = 60

        // Multi-command atomic execution pipeline
        const pipeline = redis.pipeline()
        pipeline.incr(key)
        pipeline.ttl(key)
        const results = await pipeline.exec()

        if (!results) {
            return { success: false, error: 'Redis pipeline failed' }
        }

        const currentCount = results[0][1] as number
        const ttl = results[1][1] as number

        if (currentCount === 1 || ttl === -1) {
            // First request in window, or expiry was lost — (re)set TTL
            await redis.expire(key, windowSeconds)
        }

        if (currentCount > limit) {
            return { success: false, error: `Rate limit exceeded. Maximum 2 complaints per minute allowed.` }
        }

        return { success: true }
    } catch (error) {
        // FAIL-OPEN: Redis unavailability must not block patient complaint submission.
        // The rate limit is a defence-in-depth control; duplicate-merge logic in
        // createComplaint() provides a secondary deduplication layer.
        logger.error('[stayassist-redis] Complaint rate limiter unavailable; allowing request.', {
            error: error instanceof Error ? error.message : String(error),
        })
        return { success: true }
    }
}
