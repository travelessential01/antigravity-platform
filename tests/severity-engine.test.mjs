import assert from 'node:assert/strict'
import {
  classifyComplaintSeverity,
  isHigherSeverity,
  maxComplaintSeverity,
} from '../src/lib/complaint-severity.ts'

function classify(overrides) {
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

assert.equal(
  classify({
    category: 'safety_security',
    isOngoing: true,
  }).severity,
  'critical'
)

assert.equal(
  classify({
    category: 'clinical_care',
    careContext: 'emergency',
    isOngoing: true,
  }).severity,
  'critical'
)

assert.equal(
  classify({
    category: 'medication',
  }).severity,
  'high'
)

assert.equal(
  classify({
    category: 'privacy',
  }).severity,
  'high'
)

assert.equal(
  classify({
    category: 'communication',
  }).severity,
  'medium'
)

assert.equal(
  classify({
    category: 'food_amenities',
    description: 'The food was cold.',
  }).severity,
  'low'
)

assert.equal(
  classify({
    category: 'other',
    description: 'There is smoke near the ward.',
  }).severity,
  'critical'
)

assert.equal(
  classify({
    category: 'billing',
    isRepeatUnresolved: true,
  }).severity,
  'high'
)

const decision = classify({
  category: 'medication',
  careContext: 'icu',
  isOngoing: true,
  description: 'The patient missed a scheduled dose.',
})

assert.equal(
  decision.reasonCodes.some((reasonCode) => reasonCode.startsWith('impact_')),
  false
)

assert.equal(isHigherSeverity('critical', 'high'), true)
assert.equal(isHigherSeverity('low', 'medium'), false)
assert.equal(maxComplaintSeverity('low', 'high', 'medium'), 'high')

console.log('severity-engine tests passed')
