import { describe, expect, test } from 'vitest'
import {
  calculateSlaDeadline,
  getDefaultAcknowledgementHours,
  normalizeComplaintSeverity,
  resolveAcknowledgementHours,
} from '@/lib/sla-deadline'

describe('SLA deadline helpers', () => {
  test.each([
    ['critical', 1],
    ['high', 4],
    ['medium', 8],
    ['low', 24],
  ] as const)('uses the default acknowledgement hours for %s complaints', (severity, hours) => {
    expect(getDefaultAcknowledgementHours(severity)).toBe(hours)
  })

  test('calculates ISO deadlines from strings and Date objects', () => {
    expect(calculateSlaDeadline('2026-05-16T10:00:00.000Z', 4)).toBe('2026-05-16T14:00:00.000Z')
    expect(calculateSlaDeadline(new Date('2026-05-16T10:00:00.000Z'), 1)).toBe('2026-05-16T11:00:00.000Z')
  })

  test('returns null for invalid dates', () => {
    expect(calculateSlaDeadline('not-a-date', 4)).toBeNull()
  })

  test('prefers department config, then hospital config, then default', () => {
    const configurations = [
      {
        hospital_id: 'hospital-1',
        department_id: null,
        severity_level: 'high',
        max_acknowledgement_hours: 6,
      },
      {
        hospital_id: 'hospital-1',
        department_id: 'dept-1',
        severity_level: 'high',
        max_acknowledgement_hours: 2,
      },
    ] as const

    expect(resolveAcknowledgementHours(configurations, {
      hospitalId: 'hospital-1',
      departmentId: 'dept-1',
      severity: 'high',
    })).toBe(2)

    expect(resolveAcknowledgementHours(configurations, {
      hospitalId: 'hospital-1',
      departmentId: 'dept-2',
      severity: 'high',
    })).toBe(6)

    expect(resolveAcknowledgementHours(configurations, {
      hospitalId: 'hospital-2',
      departmentId: null,
      severity: 'high',
    })).toBe(4)
  })

  test('normalizes invalid severities to low', () => {
    expect(normalizeComplaintSeverity('critical')).toBe('critical')
    expect(normalizeComplaintSeverity('unknown')).toBe('low')
    expect(normalizeComplaintSeverity(null)).toBe('low')
  })
})
