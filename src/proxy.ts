/**
 * proxy.ts - Next.js Edge Proxy (Next.js 16 convention)
 * Phase 3.6 - StayAssist V1 Auth Architecture
 *
 * Responsibilities:
 *   1. Verified user resolution plus Supabase auth cookie refresh
 *   2. Route protection - unauthenticated users redirected to /login
 *   3. Session context injection - reads sa_dept_ctx cookie, resolves active_dept_id
 *      from staff_session_context, and injects X-Active-Dept-Id so RLS helpers can
 *      read it via current_setting('request.headers')
 *
 * Public routes (no auth required):
 *   /login, /auth/*, /api/auth/otp/*, /patient/*, /mock-qr, /api/health, /api/qr
 *
 * Note: Supabase session lookup via DB is not allowed in Edge runtime.
 * The session context lookup uses the anon key with RLS, so users can only
 * read their own staff_session_context row (policy: auth_user_id = auth.uid()).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { DEPT_CONTEXT_COOKIE } from '@/lib/auth-session-cookies'

const PUBLIC_PATTERNS = [
  /^\/login/,
  /^\/auth\//,
  /^\/patient\//,
  /^\/intake(?:\/|$)/,
  /^\/mock-qr/,
  /^\/api\/auth\//,
  /^\/api\/acknowledge(?:\/|$)/,
  /^\/api\/health/,
  /^\/api\/inngest(?:\/|$)/,
  /^\/api\/qr/,
  /^\/_next\//,
  /^\/favicon/,
  /^\/public\//,
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isPublic = isPublicRoute(pathname)
  let authUserId: string | null = null

  if (!isPublic) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    authUserId = user.id
  }

  if (authUserId && !pathname.startsWith('/api/')) {
    const deptContextToken = request.cookies.get(DEPT_CONTEXT_COOKIE)?.value

    if (deptContextToken) {
      const { data: sessionContext } = await supabase
        .from('staff_session_context')
        .select('active_dept_id, expires_at')
        .eq('auth_user_id', authUserId)
        .eq('session_token', deptContextToken)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (sessionContext?.active_dept_id) {
        requestHeaders.set('x-active-dept-id', sessionContext.active_dept_id as string)
      } else {
        requestHeaders.delete('x-active-dept-id')
        response.cookies.delete(DEPT_CONTEXT_COOKIE)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export default proxy
