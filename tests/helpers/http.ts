import { expect } from 'vitest'
import { redact } from './redact'

type RequestOptions = RequestInit & {
  expectedStatus?: number | number[]
  timeoutMs?: number
}

export async function requestJson<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<{ response: Response; body: T }> {
  const { expectedStatus, timeoutMs = 10_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal })
    const text = await response.text()
    const body = text ? JSON.parse(text) as T : null as T

    if (expectedStatus !== undefined) {
      const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
      expect(
        expected.includes(response.status),
        `Expected ${url} to return ${expected.join('/')} but got ${response.status}: ${redact(body)}`
      ).toBe(true)
    }

    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestText(
  url: string,
  options: RequestOptions = {}
): Promise<{ response: Response; body: string }> {
  const { expectedStatus, timeoutMs = 10_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal })
    const body = await response.text()

    if (expectedStatus !== undefined) {
      const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
      expect(
        expected.includes(response.status),
        `Expected ${url} to return ${expected.join('/')} but got ${response.status}: ${redact(body)}`
      ).toBe(true)
    }

    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

export function jsonPost(body: unknown, headers?: HeadersInit): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }
}

export async function isReachable(url: string, timeoutMs = 2_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    await fetch(url, { method: 'GET', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
