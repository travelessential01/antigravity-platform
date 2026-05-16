import { describe, expect, test } from 'vitest'
import {
  calculateAcknowledgementSlaMinutes,
  unwrapEscalationResult,
} from '@/lib/sla-reconciliation'

describe('SLA reconciliation helpers', () => {
  test('calculates clinical SLA minutes from created_at and deadline', () => {
    expect(calculateAcknowledgementSlaMinutes({
      createdAt: '2026-05-16T10:00:00.000Z',
      slaDeadline: '2026-05-16T14:30:00.000Z',
    })).toBe(270)
  })

  test('returns zero when timestamps are missing or invalid', () => {
    expect(calculateAcknowledgementSlaMinutes({
      createdAt: 'bad-date',
      slaDeadline: '2026-05-16T14:30:00.000Z',
    })).toBe(0)
    expect(calculateAcknowledgementSlaMinutes({
      createdAt: '2026-05-16T10:00:00.000Z',
      slaDeadline: null,
    })).toBe(0)
  })

  test('unwraps Supabase RPC single-row and array responses', () => {
    const row = { outcome: 'escalated' as const, recipient_id: 'user-1' }
    expect(unwrapEscalationResult([row])).toEqual(row)
    expect(unwrapEscalationResult(row)).toEqual(row)
    expect(unwrapEscalationResult([])).toBeNull()
  })
})
