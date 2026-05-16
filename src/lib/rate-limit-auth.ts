import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'

type RateLimitResult = {
  success: boolean
  error?: string
  remaining?: number
}

async function runTokenBucket(
  key: string,
  limit: number,
  windowSeconds: number,
  message: string
): Promise<RateLimitResult> {
  try {
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
      await redis.expire(key, windowSeconds)
    }

    if (currentCount > limit) {
      return {
        success: false,
        error: message,
        remaining: 0,
      }
    }

    return { success: true, remaining: limit - currentCount }
  } catch (error) {
    logger.error('[auth-rate-limit] Redis unavailable; failing closed for auth control.', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'Authentication rate limiter unavailable.' }
  }
}

export async function rateLimitOtpRequestByIp(ip: string): Promise<RateLimitResult> {
  return runTokenBucket(
    `ratelimit:otp_request:ip:${ip}`,
    5,
    10 * 60,
    'Too many OTP requests from this IP. Try again in 10 minutes.'
  )
}

export async function rateLimitOtpRequestBySubject(subject: string): Promise<RateLimitResult> {
  return runTokenBucket(
    `ratelimit:otp_request:subject:${subject}`,
    3,
    10 * 60,
    'Too many OTP requests for this account. Try again in 10 minutes.'
  )
}

export async function rateLimitOtpVerifyByIp(ip: string): Promise<RateLimitResult> {
  return runTokenBucket(
    `ratelimit:otp_verify:ip:${ip}`,
    20,
    10 * 60,
    'Too many OTP verification attempts from this IP. Try again in 10 minutes.'
  )
}

export async function rateLimitOtpVerifyBySubject(subject: string): Promise<RateLimitResult> {
  return runTokenBucket(
    `ratelimit:otp_verify:subject:${subject}`,
    10,
    10 * 60,
    'Too many OTP verification attempts for this account. Try again in 10 minutes.'
  )
}

export async function getOtpFailureCount(subject: string): Promise<number> {
  try {
    const value = await redis.get(`otp_failures:${subject}`)
    return value ? Number.parseInt(value, 10) || 0 : 0
  } catch {
    return 0
  }
}

export async function incrementOtpFailureCount(subject: string): Promise<number> {
  try {
    const key = `otp_failures:${subject}`
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.ttl(key)
    const results = await pipeline.exec()

    if (!results) {
      return 0
    }

    const currentCount = results[0][1] as number
    const ttl = results[1][1] as number

    if (currentCount === 1 || ttl === -1) {
      await redis.expire(key, 30 * 60)
    }

    return currentCount
  } catch {
    return 0
  }
}

export async function clearOtpFailureCount(subject: string): Promise<void> {
  try {
    await redis.del(`otp_failures:${subject}`)
  } catch {
    // Failure count cleanup is best-effort only.
  }
}
