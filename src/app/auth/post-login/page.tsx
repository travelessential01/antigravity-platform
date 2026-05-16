'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { AuthShell } from '@/components/layout/auth-shell'

const MAX_ATTEMPTS = 8
const RETRY_DELAY_MS = 250

type PostLoginState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string }

export default function PostLoginPage() {
  const [state, setState] = useState<PostLoginState>({
    status: 'loading',
    message: 'Finishing sign-in...',
  })

  useEffect(() => {
    let cancelled = false

    const resolveDestination = async (attempt: number) => {
      try {
        const response = await fetch('/api/auth/post-login', {
          method: 'GET',
          cache: 'no-store',
        })

        const result = await response.json() as {
          ready?: boolean
          destination?: string
          redirectTo?: string
          reason?: string
        }

        if (cancelled) {
          return
        }

        if (response.ok && result.ready && result.destination) {
          window.location.replace(result.destination)
          return
        }

        if (result.redirectTo) {
          window.location.replace(result.redirectTo)
          return
        }

        if (response.status === 401 && attempt < MAX_ATTEMPTS) {
          window.setTimeout(() => {
            void resolveDestination(attempt + 1)
          }, RETRY_DELAY_MS)
          return
        }

        window.location.replace('/login')
      } catch {
        if (cancelled) {
          return
        }

        if (attempt < MAX_ATTEMPTS) {
          window.setTimeout(() => {
            void resolveDestination(attempt + 1)
          }, RETRY_DELAY_MS)
          return
        }

        setState({
          status: 'error',
          message: 'We could not finish sign-in automatically. Redirecting to login...',
        })
        window.setTimeout(() => {
          window.location.replace('/login')
        }, RETRY_DELAY_MS)
      }
    }

    void resolveDestination(1)

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AuthShell
      icon={<ShieldCheck className="size-5" />}
      title={state.status === 'loading' ? 'Completing authentication' : 'Redirecting'}
      description={state.message}
    >
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    </AuthShell>
  )
}
