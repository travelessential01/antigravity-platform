import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffRole } from '@/lib/staff-roles'

export interface StaffLoginCandidate {
  id: string
  role: StaffRole
  hospital_id: string
  department_id: string | null
  email: string | null
  auth_user_id: string | null
}

export interface StaffLoginContext {
  hospital: {
    id: string
    name: string
  }
  staffUser: StaffLoginCandidate
}

type StaffLookupErrorCode =
  | 'HOSPITAL_NOT_FOUND'
  | 'STAFF_NOT_FOUND'
  | 'LOOKUP_FAILED'

const STAFF_LOGIN_SELECT =
  'id, role, hospital_id, department_id, email, auth_user_id'

export const STAFF_LOGIN_PUBLIC_FAILURE_MESSAGE =
  'We could not verify staff access with those details.'

export function isStaffLoginLookupNotFound(code: StaffLookupErrorCode): boolean {
  return code === 'HOSPITAL_NOT_FOUND' || code === 'STAFF_NOT_FOUND'
}

export async function findStaffLoginContext(
  supabase: SupabaseClient,
  params: { phone: string; hospitalCode: string }
): Promise<{
  context?: StaffLoginContext
  error?: { code: StaffLookupErrorCode; message: string }
}> {
  const { phone, hospitalCode } = params

  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .select('id, name')
    .eq('hospital_code', hospitalCode)
    .is('deleted_at', null)
    .single()

  if (hospitalError || !hospital) {
    return {
      error: {
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found. Check your hospital code.',
      },
    }
  }

  const { data: staffUser, error: staffError } = await supabase
    .from('users')
    .select(STAFF_LOGIN_SELECT)
    .eq('phone', phone)
    .eq('hospital_id', hospital.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (staffError) {
    return {
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Failed to verify staff access. Please try again.',
      },
    }
  }

  if (!staffUser) {
    return {
      error: {
        code: 'STAFF_NOT_FOUND',
        message: 'No active staff account found for this phone number at that hospital.',
      },
    }
  }

  return {
    context: {
      hospital,
      staffUser: staffUser as StaffLoginCandidate,
    },
  }
}
