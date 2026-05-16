export const DEFAULT_COMPLAINT_SEVERITY = 'low' as const

export type ComplaintSeverity = 'critical' | 'high' | 'medium' | 'low'

export const DEFAULT_ACKNOWLEDGEMENT_HOURS_BY_SEVERITY: Record<ComplaintSeverity, number> = {
  critical: 1,
  high: 4,
  medium: 8,
  low: 24,
}

export const DEFAULT_RESOLUTION_HOURS_BY_SEVERITY: Record<ComplaintSeverity, number> = {
  critical: 24,
  high: 72,
  medium: 168,
  low: 720,
}

export const DEFAULT_ACKNOWLEDGEMENT_HOURS =
  DEFAULT_ACKNOWLEDGEMENT_HOURS_BY_SEVERITY[DEFAULT_COMPLAINT_SEVERITY]

export type SlaConfiguration = {
  hospital_id: string
  department_id: string | null
  severity_level: ComplaintSeverity
  max_acknowledgement_hours: number
}

const SEVERITIES = new Set<ComplaintSeverity>(['critical', 'high', 'medium', 'low'])

export function normalizeComplaintSeverity(
  severity: string | null | undefined
): ComplaintSeverity {
  if (SEVERITIES.has(severity as ComplaintSeverity)) {
    return severity as ComplaintSeverity
  }

  return DEFAULT_COMPLAINT_SEVERITY
}

export function calculateSlaDeadline(createdAt: Date | string, acknowledgementHours: number) {
  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt)
  if (!Number.isFinite(createdAtMs)) {
    return null
  }

  return new Date(createdAtMs + acknowledgementHours * 60 * 60 * 1000).toISOString()
}

export function getDefaultAcknowledgementHours(severity: ComplaintSeverity) {
  return DEFAULT_ACKNOWLEDGEMENT_HOURS_BY_SEVERITY[severity]
}

export function resolveAcknowledgementHours(
  configurations: SlaConfiguration[],
  input: {
    hospitalId: string
    departmentId: string | null
    severity: ComplaintSeverity
  }
) {
  const departmentConfig = configurations.find((configuration) =>
    configuration.hospital_id === input.hospitalId &&
    configuration.department_id === input.departmentId &&
    configuration.severity_level === input.severity
  )

  const hospitalConfig = configurations.find((configuration) =>
    configuration.hospital_id === input.hospitalId &&
    configuration.department_id === null &&
    configuration.severity_level === input.severity
  )

  return (
    departmentConfig?.max_acknowledgement_hours ??
    hospitalConfig?.max_acknowledgement_hours ??
    getDefaultAcknowledgementHours(input.severity)
  )
}
