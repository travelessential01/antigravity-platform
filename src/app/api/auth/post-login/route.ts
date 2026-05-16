import { NextResponse } from 'next/server'
import { AuthError, requireUser } from '@/lib/auth-guard'
import { resolvePostLoginPath } from '@/lib/post-login'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json({
      ready: true,
      destination: resolvePostLoginPath(user),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'DEACTIVATED') {
        return NextResponse.json(
          {
            ready: false,
            redirectTo: '/login?error=deactivated',
            reason: error.code,
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          ready: false,
          reason: error.code,
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        ready: false,
        redirectTo: '/login',
        reason: 'UNKNOWN',
      },
      { status: 500 }
    )
  }
}
