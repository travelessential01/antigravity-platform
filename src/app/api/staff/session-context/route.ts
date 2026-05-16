/**
 * /api/staff/session-context/route.ts
 * Phase 3.5 - Staff Session Context API
 *
 * GET  -> returns the current active department context for auth.uid()
 * POST -> creates a new 8-hour session context (department selection at login)
 *
 * Rules:
 *   - POST only allowed immediately after aal1/aal2 login (first context creation)
 *   - No mid-session switching: if a valid context exists, POST is rejected
 *   - The department selected must be in the user's user_department_assignments
 *   - session_token is stored in the HttpOnly sa_dept_ctx cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { AuthError, requireUser } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEPT_CONTEXT_COOKIE } from '@/lib/auth-session-cookies'

export const runtime = 'nodejs'

const SESSION_TTL_SECONDS = 60 * 60 * 8

async function getServiceClient() {
  return createAdminClient()
}

export async function GET() {
  try {
    const user = await requireUser()
    const cookieStore = await cookies()
    const contextToken = cookieStore.get(DEPT_CONTEXT_COOKIE)?.value
    const nowIso = new Date().toISOString()

    if (!contextToken) {
      return NextResponse.json({ context: null })
    }

    const supabase = await getServiceClient()
    const { data: context } = await supabase
      .from('staff_session_context')
      .select('active_dept_id, hospital_id, expires_at')
      .eq('auth_user_id', user.authUserId)
      .eq('session_token', contextToken)
      .gt('expires_at', nowIso)
      .single()

    if (!context) {
      const response = NextResponse.json({ context: null })
      response.cookies.delete(DEPT_CONTEXT_COOKIE)
      return response
    }

    const { data: assignment } = await supabase
      .from('user_department_assignments')
      .select('id, is_active, valid_until')
      .eq('user_id', user.id)
      .eq('department_id', context.active_dept_id)
      .eq('hospital_id', user.hospitalId)
      .maybeSingle()

    const assignmentStillValid =
      !!assignment &&
      assignment.is_active === true &&
      (!assignment.valid_until || new Date(assignment.valid_until).toISOString() > nowIso)

    if (!assignmentStillValid) {
      const response = NextResponse.json({ context: null })
      response.cookies.delete(DEPT_CONTEXT_COOKIE)
      return response
    }

    return NextResponse.json({ context })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch session context.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const cookieStore = await cookies()
    const nowIso = new Date().toISOString()

    const existingToken = cookieStore.get(DEPT_CONTEXT_COOKIE)?.value
    if (existingToken) {
      const supabase = await getServiceClient()
      const { data: existing } = await supabase
        .from('staff_session_context')
        .select('id, expires_at')
        .eq('auth_user_id', user.authUserId)
        .eq('session_token', existingToken)
        .gt('expires_at', nowIso)
        .single()

      if (existing) {
        return NextResponse.json(
          {
            error:
              'Session context already set. Department cannot be changed mid-session. Please log out and log in again.',
          },
          { status: 409 }
        )
      }
    }

    const body = (await req.json()) as { activeDeptId?: string }
    const activeDeptId = body.activeDeptId?.trim()

    if (!activeDeptId) {
      return NextResponse.json({ error: 'activeDeptId is required.' }, { status: 400 })
    }

    const supabase = await getServiceClient()
    const { data: assignment } = await supabase
      .from('user_department_assignments')
      .select('id, is_active, valid_until')
      .eq('user_id', user.id)
      .eq('department_id', activeDeptId)
      .eq('hospital_id', user.hospitalId)
      .maybeSingle()

    const assignmentStillValid =
      !!assignment &&
      assignment.is_active === true &&
      (!assignment.valid_until || new Date(assignment.valid_until).toISOString() > nowIso)

    if (!assignmentStillValid) {
      logger.warn('[SessionContext:POST] Unauthorized dept selection', {
        userId: user.id,
        activeDeptId,
      })
      return NextResponse.json({ error: 'You are not assigned to this department.' }, { status: 403 })
    }

    const sessionToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()

    const { error: insertError } = await supabase.from('staff_session_context').insert({
      auth_user_id: user.authUserId,
      active_dept_id: activeDeptId,
      hospital_id: user.hospitalId,
      session_token: sessionToken,
      expires_at: expiresAt,
    })

    if (insertError) {
      logger.error('[SessionContext:POST] Insert failed', { error: insertError.message })
      return NextResponse.json({ error: 'Failed to create session context.' }, { status: 500 })
    }

    const response = NextResponse.json({ success: true, activeDeptId, expiresAt })
    response.cookies.set(DEPT_CONTEXT_COOKIE, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    })

    logger.info('[SessionContext:POST] Context established', {
      userId: user.id,
      activeDeptId,
    })

    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    logger.error('[SessionContext:POST]', { error: String(error) })
    return NextResponse.json({ error: 'Failed to set session context.' }, { status: 500 })
  }
}
