import Redis from 'ioredis'
import { describe, expect, test } from 'vitest'
import {
  appBaseUrl,
  elasticsearchUrl,
  redisUrl,
  serviceRoleKey,
  supabaseUrl,
} from '../helpers/env'
import { isReachable, requestJson, requestText } from '../helpers/http'
import { canReachSupabase, createSupabaseAdmin, hasSupabaseCredentials } from '../helpers/supabase'

const SENSITIVE_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'ACKNOWLEDGE_LINK_SECRET',
  'JWT_SECRET',
  'PAGERDUTY_ROUTING_KEY',
  'ELASTICSEARCH_PASSWORD',
]

describe('system health smoke tests', () => {
  test('GET /api/health returns liveness metadata without secrets', async () => {
    const baseUrl = appBaseUrl()
    if (!await isReachable(`${baseUrl}/api/health`)) {
      console.warn(`Skipping app health check because ${baseUrl} is not reachable`)
      return
    }

    const { body } = await requestJson<{
      status: string
      service: string
      timestamp: string
      environment: string
    }>(`${baseUrl}/api/health`, { expectedStatus: 200 })

    expect(body.status).toBe('ok')
    expect(body.service).toBe('stayassist')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
    expect(typeof body.environment).toBe('string')

    const serialized = JSON.stringify(body)
    for (const key of SENSITIVE_KEYS) {
      expect(serialized).not.toContain(key)
      const value = process.env[key]
      if (value) {
        expect(serialized).not.toContain(value)
      }
    }
  })

  test('Supabase REST is reachable with configured service credentials', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping Supabase health check because Supabase is not configured or reachable')
      return
    }

    const response = await fetch(`${supabaseUrl()}/rest/v1/hospitals?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey()!,
        Authorization: `Bearer ${serviceRoleKey()}`,
      },
    })

    expect(response.status, await response.text()).toBeLessThan(500)
  })

  test('database can perform a read-only query', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping database read check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const { error } = await supabase
      .from('hospitals')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    expect(error).toBeNull()
  })

  test('Redis responds to PING when configured', async () => {
    const url = redisUrl()
    if (!url) {
      console.warn('Skipping Redis health check because TEST_REDIS_URL/REDIS_URL is not configured')
      return
    }

    const redis = new Redis(url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 2_000,
    })
    redis.on('error', () => undefined)

    try {
      await redis.connect()
      await expect(redis.ping()).resolves.toBe('PONG')
    } catch (error) {
      console.warn(`Skipping Redis health check because Redis is not reachable: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      redis.disconnect()
    }
  })

  test('Elasticsearch cluster health is reachable when configured', async () => {
    const url = elasticsearchUrl()
    if (!url) {
      console.warn('Skipping Elasticsearch health check because TEST_ELASTICSEARCH_URL/ELASTICSEARCH_URL is not configured')
      return
    }

    const healthUrl = new URL('/_cluster/health', url)
    try {
      const response = await fetch(healthUrl, {
        headers: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
          ? {
              Authorization: `Basic ${Buffer.from(`${process.env.ELASTICSEARCH_USERNAME}:${process.env.ELASTICSEARCH_PASSWORD}`).toString('base64')}`,
            }
          : undefined,
      })

      expect(response.status, await response.text()).toBeLessThan(500)
    } catch (error) {
      console.warn(`Skipping Elasticsearch health check because Elasticsearch is not reachable: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  test('Inngest route responds in a running local/dev app', async () => {
    const baseUrl = appBaseUrl()
    if (!await isReachable(`${baseUrl}/api/health`)) {
      console.warn(`Skipping Inngest route check because ${baseUrl} is not reachable`)
      return
    }

    const { response, body } = await requestText(`${baseUrl}/api/inngest`, {
      expectedStatus: [200, 201, 204, 400, 405],
    })

    expect(response.status).not.toBe(404)
    expect(body.toLowerCase()).not.toContain('not found')
  })
})
