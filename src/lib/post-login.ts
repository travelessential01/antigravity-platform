import type { AuthenticatedUser } from '@/lib/auth-guard'
import { normalizeRoleName } from '@/lib/auth-utils'

export function resolvePostLoginPath(user: AuthenticatedUser) {
  const role = normalizeRoleName(user.role)

  if (role === 'admin' || role === 'medical_superintendent') {
    return '/org-dashboard'
  }

  if (role === 'dpo') {
    return '/investigator'
  }

  if (user.staffType === 'float' && !user.activeDepartmentId) {
    return '/select-department'
  }

  return '/dashboard'
}
