/**
 * GET /api/hospitals
 * Sprint A.8 - StayAssist V1 API Route Security
 *
 * Internal endpoint for the mock-QR asset generation tool.
 * Returns the list of active hospitals.
 *
 * SECURITY CHANGE FROM PRE-SPRINT:
 *   Previously had zero authentication.
 *   Now enforces Admin role plus MFA via requireApiPrivileged().
 *   Uses a user-scoped client (respects RLS) instead of bypassing with service-role.
 *
 * Access: Admin + MFA required.
 * Public: No - returns 401 for unauthenticated, 403 for wrong role or missing MFA.
 */

import { NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/auth-guard'
import { requireApiPrivileged } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { errorResponse } = await requireApiPrivileged(['Admin'])
  if (errorResponse) return errorResponse

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
