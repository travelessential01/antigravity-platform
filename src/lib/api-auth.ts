import { NextResponse } from 'next/server'
import {
  AuthError,
  requirePrivileged,
  requireRole,
  type AuthenticatedUser,
} from '@/lib/auth-guard'

type ApiAuthResult = {
  user: AuthenticatedUser | null
  errorResponse: NextResponse | null
}

function toErrorResponse(error: unknown): ApiAuthResult {
  if (error instanceof AuthError) {
    const status =
      error.code === 'UNAUTHORIZED'
        ? 401
        : error.code === 'DEACTIVATED'
          ? 403
          : error.code === 'MFA_REQUIRED'
            ? 403
            : 403

    return {
      user: null,
      errorResponse: NextResponse.json({ error: error.message }, { status }),
    }
  }

  return {
    user: null,
    errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}

export async function requireApiRole(allowedRoles: string[]): Promise<ApiAuthResult> {
  try {
    const user = await requireRole(allowedRoles)
    return { user, errorResponse: null }
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function requireApiPrivileged(allowedRoles: string[]): Promise<ApiAuthResult> {
  try {
    const user = await requirePrivileged(allowedRoles)
    return { user, errorResponse: null }
  } catch (error) {
    return toErrorResponse(error)
  }
}
