import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  clearAuthContextCookies,
  DEPT_CONTEXT_COOKIE,
} from '@/lib/auth-session-cookies'

export const runtime = 'nodejs'

export async function POST() {
  const cookieStore = await cookies()
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const deptContextToken = cookieStore.get(DEPT_CONTEXT_COOKIE)?.value ?? null

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user && deptContextToken) {
      const adminClient = createAdminClient()
      const { error } = await adminClient
        .from('staff_session_context')
        .delete()
        .eq('auth_user_id', user.id)
        .eq('session_token', deptContextToken)

      if (error) {
        logger.warn('[auth:logout] Failed to clear session context row', {
          authUserId: user.id,
          error: error.message,
        })
      }
    }
  } catch (error) {
    logger.warn('[auth:logout] Verified user lookup failed during logout cleanup', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  await supabase.auth.signOut().catch((error) => {
    logger.warn('[auth:logout] Supabase sign-out failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  })

  clearAuthContextCookies(response)
  return response
}
