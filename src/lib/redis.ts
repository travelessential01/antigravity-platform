import Redis from 'ioredis'
import { logger } from '@/lib/logger'

const globalForRedis = globalThis as typeof globalThis & {
  __stayassistRedis?: Redis
  __stayassistRedisErrorHandlerAttached?: boolean
}

function createRedisClient() {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6380', {
    lazyConnect: true,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  })
}

export const redis = globalForRedis.__stayassistRedis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__stayassistRedis = redis
}

if (!globalForRedis.__stayassistRedisErrorHandlerAttached) {
  redis.on('error', (error) => {
    logger.warn('[stayassist-redis] Redis client error', {
      error: error instanceof Error ? error.message : String(error),
    })
  })

  globalForRedis.__stayassistRedisErrorHandlerAttached = true
}
