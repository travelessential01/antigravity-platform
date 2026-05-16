import { describe, expect, test } from 'vitest'
import { appBaseUrl } from '../helpers/env'
import { isReachable, requestJson, requestText } from '../helpers/http'

const protectedRoutes = [
  { method: 'GET', path: '/api/qr/generate?hospitalId=00000000-0000-0000-0000-000000000000' },
  { method: 'GET', path: '/api/export-pdf?hospitalId=00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/dpo/investigator', body: {} },
  { method: 'POST', path: '/api/dpo/export-forensic', body: {} },
  { method: 'POST', path: '/api/escalation/resolve', body: { complaintId: '00000000-0000-0000-0000-000000000000' } },
]

describe('API authorization smoke tests', () => {
  test.each(protectedRoutes)('$method $path rejects missing session', async (route) => {
    const baseUrl = appBaseUrl()
    if (!await isReachable(`${baseUrl}/api/health`)) {
      console.warn(`Skipping API authz check because ${baseUrl} is not reachable`)
      return
    }

    const init: RequestInit = {
      method: route.method,
      headers: route.body ? { 'Content-Type': 'application/json' } : undefined,
      body: route.body ? JSON.stringify(route.body) : undefined,
    }

    const { response, body } = route.body
      ? await requestJson(`${baseUrl}${route.path}`, { ...init, expectedStatus: [401, 403] })
      : await requestText(`${baseUrl}${route.path}`, { ...init, expectedStatus: [401, 403] })

    expect([401, 403]).toContain(response.status)
    expect(JSON.stringify(body).toLowerCase()).toMatch(/unauthorized|session|mfa|required|forbidden/)
  })

  test('QR route validates parameters only after auth', async () => {
    const baseUrl = appBaseUrl()
    if (!await isReachable(`${baseUrl}/api/health`)) {
      console.warn(`Skipping QR auth order check because ${baseUrl} is not reachable`)
      return
    }

    const { response } = await requestJson(`${baseUrl}/api/qr/generate`, {
      expectedStatus: [401, 403],
    })

    expect([401, 403]).toContain(response.status)
  })
})
