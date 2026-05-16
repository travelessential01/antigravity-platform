import crypto from 'node:crypto'
import { afterEach, describe, expect, test } from 'vitest'
import { createAcknowledgeToken } from '@/lib/acknowledgement-links'
import { appBaseUrl, env, redisUrl } from '../helpers/env'
import { isReachable, jsonPost, requestJson } from '../helpers/http'
import { createAcknowledgeFixture, type AcknowledgeFixture } from '../helpers/fixtures'
import { canReachSupabase, createSupabaseAdmin, hasSupabaseCredentials } from '../helpers/supabase'

type AcknowledgeResponse = {
  success?: boolean
  complaintId?: string
  outcome?: string
  error?: string
}

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.()
  }
})

async function canRunAcknowledgeTests() {
  const baseUrl = appBaseUrl()
  if (!await isReachable(`${baseUrl}/api/health`)) {
    console.warn(`Skipping acknowledge integration check because ${baseUrl} is not reachable`)
    return false
  }

  if (!hasSupabaseCredentials() || !await canReachSupabase()) {
    console.warn('Skipping acknowledge integration check because Supabase is not configured or reachable')
    return false
  }

  if (!env('ACKNOWLEDGE_LINK_SECRET')) {
    console.warn('Skipping acknowledge integration check because ACKNOWLEDGE_LINK_SECRET is not configured')
    return false
  }

  return true
}

function makeToken(expiresInSeconds = 900) {
  const complaintId = crypto.randomUUID()
  const linkId = crypto.randomUUID()
  const token = createAcknowledgeToken({ complaintId, linkId, expiresInSeconds })
  return { complaintId, linkId, token }
}

async function makeFixture(): Promise<{ token: string; fixture: AcknowledgeFixture }> {
  const linkId = crypto.randomUUID()
  const token = createAcknowledgeToken({
    complaintId: crypto.randomUUID(),
    linkId,
  })
  const fixture = await createAcknowledgeFixture(createSupabaseAdmin(), {
    secureLinkId: linkId,
    token,
  })

  const fixtureToken = createAcknowledgeToken({
    complaintId: fixture.complaintId,
    linkId,
  })

  cleanups.push(fixture.cleanup)
  return { token: fixtureToken, fixture }
}

async function postAcknowledge(token: string, ip = crypto.randomUUID()) {
  return requestJson<AcknowledgeResponse>(`${appBaseUrl()}/api/acknowledge`, {
    ...jsonPost({ token }, { 'x-forwarded-for': `10.44.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`, 'x-test-ip': ip }),
  })
}

describe('/api/acknowledge integration', () => {
  test('accepts a valid signed token with matching pending notification', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    const { token, fixture } = await makeFixture()
    const { response, body } = await postAcknowledge(token)

    expect(response.status, JSON.stringify(body)).toBe(200)
    expect(body.success).toBe(true)
    expect(body.complaintId).toBe(fixture.complaintId)
    expect(body.outcome).toMatch(/acknowledged|already_acknowledged|already_read/)
  })

  test('returns idempotent success on replay of a consumed token', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    const { token } = await makeFixture()
    const first = await postAcknowledge(token)
    expect(first.response.status, JSON.stringify(first.body)).toBe(200)

    const replay = await postAcknowledge(token)
    expect(replay.response.status, JSON.stringify(replay.body)).toBe(200)
    expect(replay.body.outcome).toMatch(/already_acknowledged|already_read/)
  })

  test('rejects malformed and tampered tokens', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    const malformed = await postAcknowledge('not-a-token')
    expect(malformed.response.status).toBe(401)

    const { token } = makeToken()
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
    const tamperedResult = await postAcknowledge(tampered)
    expect(tamperedResult.response.status).toBe(401)
  })

  test('rejects expired tokens before database lookup', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    const { token } = makeToken(-60)
    const result = await postAcknowledge(token)
    expect(result.response.status).toBe(401)
    expect(result.body.error?.toLowerCase()).toContain('expired')
  })

  test('rejects valid tokens that do not match an issued secure link', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    const { token } = makeToken()
    const result = await postAcknowledge(token)
    expect(result.response.status).toBe(401)
    expect(result.body.error?.toLowerCase()).toMatch(/unknown|revoked/)
  })

  test('rate-limits the sixth request from one IP when Redis is configured', async () => {
    if (!await canRunAcknowledgeTests()) {
      return
    }

    if (!redisUrl()) {
      console.warn('Skipping acknowledge rate-limit check because TEST_REDIS_URL/REDIS_URL is not configured')
      return
    }

    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    const statuses: number[] = []
    for (let index = 0; index < 6; index++) {
      const response = await requestJson<AcknowledgeResponse>(`${appBaseUrl()}/api/acknowledge`, {
        ...jsonPost({ token: `invalid-${index}` }, { 'x-forwarded-for': ip }),
      })
      statuses.push(response.response.status)
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
  })
})
