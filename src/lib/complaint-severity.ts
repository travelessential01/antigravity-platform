import type { ComplaintSeverity } from './sla-deadline'

export const COMPLAINT_SEVERITY_VALUES = ['critical', 'high', 'medium', 'low'] as const

export const TRIAGE_CATEGORY_VALUES = [
  'clinical_care',
  'medication',
  'safety_security',
  'privacy',
  'access_delay',
  'environment',
  'communication',
  'billing',
  'food_amenities',
  'other',
] as const

// Legacy server-compatibility only. Patient intake no longer exposes impact.
export const TRIAGE_IMPACT_VALUES = [
  'immediate_danger',
  'serious_harm',
  'possible_harm',
  'care_blocked',
  'service_issue',
  'minor_issue',
] as const

export const TRIAGE_CARE_CONTEXT_VALUES = [
  'none',
  'emergency',
  'icu',
  'inpatient',
  'outpatient',
  'discharge',
] as const

export type ComplaintTriageCategory = (typeof TRIAGE_CATEGORY_VALUES)[number]
export type ComplaintTriageCareContext = (typeof TRIAGE_CARE_CONTEXT_VALUES)[number]

export type ComplaintTriageInput = {
  category: ComplaintTriageCategory
  isOngoing: boolean
  careContext?: ComplaintTriageCareContext
}

export type ComplaintSeverityDecision = {
  severity: ComplaintSeverity
  reasonCodes: string[]
}

export const TRIAGE_CATEGORY_OPTIONS: Array<{
  value: ComplaintTriageCategory
  label: string
}> = [
    { value: 'clinical_care', label: 'Clinical care' },
    { value: 'medication', label: 'Medication' },
    { value: 'safety_security', label: 'Safety or security' },
    { value: 'privacy', label: 'Privacy' },
    { value: 'access_delay', label: 'Delay or access' },
    { value: 'environment', label: 'Cleanliness or facility' },
    { value: 'communication', label: 'Communication' },
    { value: 'billing', label: 'Billing or admin' },
    { value: 'food_amenities', label: 'Food or amenities' },
    { value: 'other', label: 'Other' },
  ]

export const TRIAGE_CARE_CONTEXT_OPTIONS: Array<{
  value: ComplaintTriageCareContext
  label: string
}> = [
    { value: 'none', label: 'Not clinical' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'icu', label: 'ICU or critical care' },
    { value: 'inpatient', label: 'Inpatient' },
    { value: 'outpatient', label: 'Outpatient' },
    { value: 'discharge', label: 'Discharge' },
  ]

const SEVERITY_RANK: Record<ComplaintSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

const CRITICAL_TEXT_PATTERNS = [
  /\b(fire|smoke|violence|violent|assault|abuse|threat|security breach)\b/i,
  /\b(unconscious|not breathing|breathless|chest pain|stroke|seizure|sepsis)\b/i,
  /\b(heavy bleeding|blood transfusion|anaphylaxis|allergic reaction|overdose)\b/i,
  /\b(wrong medication|wrong medicine|wrong patient|fall with injury|head injury)\b/i,
  /\b(suicide|self harm|self-harm)\b/i,
]

const HIGH_TEXT_PATTERNS = [
  /\b(infection|infected|needle stick|needlestick|medication|medicine|missed dose|wrong dose)\b/i,
  /\b(privacy breach|data leak|confidential|consent|records exposed)\b/i,
  /\b(delayed treatment|delayed surgery|no doctor|not attended|diagnostic delay)\b/i,
  /\b(discharge blocked|billing blocked|insurance blocked|care delayed)\b/i,
]

const MEDIUM_TEXT_PATTERNS = [
  /\b(long wait|waiting|delay|rude|communication|explained|cleanliness|dirty)\b/i,
  /\b(housekeeping|maintenance|billing delay|refund|queue|appointment)\b/i,
]

const HIGH_BASE_CATEGORIES = new Set<ComplaintTriageCategory>([
  'medication',
  'privacy',
  'safety_security',
])

const MEDIUM_BASE_CATEGORIES = new Set<ComplaintTriageCategory>([
  'clinical_care',
  'access_delay',
  'environment',
  'communication',
  'billing',
])

const CRITICAL_CARE_CONTEXTS = new Set<ComplaintTriageCareContext>([
  'emergency',
  'icu',
])

const HIGH_CRITICAL_CARE_CATEGORIES = new Set<ComplaintTriageCategory>([
  'clinical_care',
  'medication',
  'access_delay',
  'safety_security',
  'environment',
])

const ONGOING_CRITICAL_CARE_CATEGORIES = new Set<ComplaintTriageCategory>([
  'clinical_care',
  'medication',
  'access_delay',
])

const ONGOING_INPATIENT_CARE_CONTEXTS = new Set<ComplaintTriageCareContext>([
  'inpatient',
  'discharge',
])

const ONGOING_INPATIENT_CATEGORIES = new Set<ComplaintTriageCategory>([
  'clinical_care',
  'access_delay',
])

export function compareComplaintSeverity(
  a: ComplaintSeverity,
  b: ComplaintSeverity
) {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b]
}

export function isHigherSeverity(
  candidate: ComplaintSeverity,
  baseline: ComplaintSeverity
) {
  return compareComplaintSeverity(candidate, baseline) > 0
}

export function maxComplaintSeverity(
  ...severities: ComplaintSeverity[]
): ComplaintSeverity {
  return severities.reduce((highest, severity) =>
    isHigherSeverity(severity, highest) ? severity : highest
  )
}

function addReason(reasonCodes: Set<string>, reasonCode: string) {
  reasonCodes.add(reasonCode)
}

function raiseSeverity(
  current: ComplaintSeverity,
  candidate: ComplaintSeverity
) {
  return isHigherSeverity(candidate, current) ? candidate : current
}

function descriptionMatches(description: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(description))
}

export function classifyComplaintSeverity(input: {
  triage: ComplaintTriageInput
  description: string
  isRepeatUnresolved?: boolean
}): ComplaintSeverityDecision {
  const reasonCodes = new Set<string>()
  const triage = input.triage
  const careContext = triage.careContext ?? 'none'
  const description = input.description.trim()
  let severity: ComplaintSeverity = 'low'

  if (HIGH_BASE_CATEGORIES.has(triage.category)) {
    severity = raiseSeverity(severity, 'high')
    addReason(reasonCodes, `category_${triage.category}`)
  }

  if (MEDIUM_BASE_CATEGORIES.has(triage.category)) {
    severity = raiseSeverity(severity, 'medium')
    addReason(reasonCodes, `category_${triage.category}`)
  }

  if (
    CRITICAL_CARE_CONTEXTS.has(careContext) &&
    HIGH_CRITICAL_CARE_CATEGORIES.has(triage.category)
  ) {
    severity = raiseSeverity(severity, 'high')
    addReason(reasonCodes, `care_context_${careContext}_${triage.category}`)
  }

  if (
    ONGOING_INPATIENT_CARE_CONTEXTS.has(careContext) &&
    ONGOING_INPATIENT_CATEGORIES.has(triage.category)
  ) {
    severity = raiseSeverity(severity, 'medium')
    addReason(reasonCodes, `care_context_${careContext}_${triage.category}`)
  }

  if (triage.isOngoing && triage.category === 'safety_security') {
    severity = raiseSeverity(severity, 'critical')
    addReason(reasonCodes, 'ongoing_safety_security_risk')
  }

  if (
    triage.isOngoing &&
    CRITICAL_CARE_CONTEXTS.has(careContext) &&
    ONGOING_CRITICAL_CARE_CATEGORIES.has(triage.category)
  ) {
    severity = raiseSeverity(severity, 'critical')
    addReason(reasonCodes, 'ongoing_critical_care_risk')
  }

  if (
    triage.isOngoing &&
    ONGOING_INPATIENT_CARE_CONTEXTS.has(careContext) &&
    ONGOING_INPATIENT_CATEGORIES.has(triage.category)
  ) {
    severity = raiseSeverity(severity, 'high')
    addReason(reasonCodes, 'ongoing_inpatient_or_discharge_care_risk')
  }

  if (descriptionMatches(description, CRITICAL_TEXT_PATTERNS)) {
    severity = raiseSeverity(severity, 'critical')
    addReason(reasonCodes, 'description_critical_red_flag')
  }

  if (input.isRepeatUnresolved) {
    severity = raiseSeverity(severity, 'high')
    addReason(reasonCodes, 'repeat_unresolved_complaint')
  }

  if (descriptionMatches(description, HIGH_TEXT_PATTERNS)) {
    severity = raiseSeverity(severity, 'high')
    addReason(reasonCodes, 'description_high_red_flag')
  }

  if (descriptionMatches(description, MEDIUM_TEXT_PATTERNS)) {
    severity = raiseSeverity(severity, 'medium')
    addReason(reasonCodes, 'description_medium_signal')
  }

  if (reasonCodes.size === 0) {
    addReason(reasonCodes, 'low_default')
  }

  return {
    severity,
    reasonCodes: Array.from(reasonCodes),
  }
}
