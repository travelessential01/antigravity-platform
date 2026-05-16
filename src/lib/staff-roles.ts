export const STAFF_ROLE_VALUES = [
  'department_manager',
  'quality_coordinator',
  'admin',
  'medical_superintendent',
  'dpo',
] as const

export type StaffRole = (typeof STAFF_ROLE_VALUES)[number]

export const STAFF_ROLE_OPTIONS: Array<{
  value: StaffRole
  label: string
}> = [
  { value: 'department_manager', label: 'Department Manager' },
  { value: 'quality_coordinator', label: 'Quality Coordinator' },
  { value: 'admin', label: 'Admin' },
  { value: 'medical_superintendent', label: 'Medical Superintendent' },
  { value: 'dpo', label: 'DPO' },
]
