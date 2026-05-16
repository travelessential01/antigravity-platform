import { describe, expect, test } from 'vitest'
import {
  classifyComplaintSeverity,
  isHigherSeverity,
  maxComplaintSeverity,
} from '@/lib/complaint-severity'

function classify(overrides: {
  description?: string
  category?: Parameters<typeof classifyComplaintSeverity>[0]['triage']['category']
  careContext?: Parameters<typeof classifyComplaintSeverity>[0]['triage']['careContext']
  isOngoing?: boolean
  isRepeatUnresolved?: boolean
}) {
  return classifyComplaintSeverity({
    description: overrides.description ?? 'General complaint',
    triage: {
      category: overrides.category ?? 'other',
      careContext: overrides.careContext ?? 'none',
      isOngoing: overrides.isOngoing ?? false,
    },
    isRepeatUnresolved: overrides.isRepeatUnresolved ?? false,
  })
}

describe('complaint severity classifier', () => {
  test.each([
    [{ category: 'safety_security', isOngoing: true }, 'critical'],
    [{ category: 'clinical_care', careContext: 'emergency', isOngoing: true }, 'critical'],
    [{ category: 'medication' }, 'high'],
    [{ category: 'privacy' }, 'high'],
    [{ category: 'communication' }, 'medium'],
    [{ category: 'food_amenities', description: 'The food was cold.' }, 'low'],
    [{ category: 'other', description: 'There is smoke near the ward.' }, 'critical'],
    [{ category: 'billing', isRepeatUnresolved: true }, 'high'],
  ] as const)('classifies %j as %s', (input, expected) => {
    expect(classify(input).severity).toBe(expected)
  })

  test('does not emit legacy impact reason codes', () => {
    const decision = classify({
      category: 'medication',
      careContext: 'icu',
      isOngoing: true,
      description: 'The patient missed a scheduled dose.',
    })

    expect(decision.reasonCodes.some((reasonCode) => reasonCode.startsWith('impact_'))).toBe(false)
  })

  test('compares severities in clinical priority order', () => {
    expect(isHigherSeverity('critical', 'high')).toBe(true)
    expect(isHigherSeverity('low', 'medium')).toBe(false)
    expect(maxComplaintSeverity('low', 'high', 'medium')).toBe('high')
  })
})
