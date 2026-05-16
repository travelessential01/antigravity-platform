'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'

type SubmitState =
  | { kind: 'loading'; message: string }
  | { kind: 'error'; title: string; message: string }

function mapFailureMessage(status: number, fallback: string | undefined) {
  if (status === 401) {
    return 'This secure link is invalid or the token has already expired.'
  }

  if (status === 410) {
    return 'This secure link expired before it could be used.'
  }

  if (status === 404) {
    return 'The complaint tied to this secure link could not be found anymore.'
  }

  return fallback ?? 'We could not finish the acknowledgement request.'
}

function EscalationLandingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasPostedRef = React.useRef(false)
  const [state, setState] = React.useState<SubmitState>({
    kind: 'loading',
    message: 'Validating the secure acknowledgement link...',
  })
  const [retryKey, setRetryKey] = React.useState(0)

  const complaintId = searchParams.get('context')
  const token = searchParams.get('token')
  const escalated = searchParams.get('escalated') === 'true'

  React.useEffect(() => {
    if (!complaintId || !token) {
      setState({
        kind: 'error',
        title: 'Secure link is incomplete',
        message:
          'This escalation link is missing the complaint context or token, so the dashboard cannot acknowledge it safely.',
      })
      return
    }

    if (hasPostedRef.current) {
      return
    }

    hasPostedRef.current = true
    let isCancelled = false

    const submitAcknowledgement = async () => {
      try {
        const response = await fetch('/api/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        })

        const payload = (await response.json().catch(() => ({}))) as {
          complaintId?: string
          outcome?: string
          error?: string
        }

        if (isCancelled) {
          return
        }

        if (response.ok && payload.complaintId) {
          const nextSearchParams = new URLSearchParams({
            context: payload.complaintId,
            ack: payload.outcome ?? 'acknowledged',
          })
          router.replace(`/dashboard?${nextSearchParams.toString()}`)
          return
        }

        setState({
          kind: 'error',
          title: 'Acknowledgement could not be completed',
          message: mapFailureMessage(response.status, payload.error),
        })
      } catch {
        if (isCancelled) {
          return
        }

        setState({
          kind: 'error',
          title: 'Network interruption',
          message:
            'The request did not complete cleanly. You can retry safely because secure-link acknowledgement is now idempotent after success.',
        })
      }
    }

    void submitAcknowledgement()

    return () => {
      isCancelled = true
    }
  }, [complaintId, retryKey, router, token])

  React.useEffect(() => {
    hasPostedRef.current = false
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
        {state.kind === 'loading' ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                {escalated ? 'Secondary escalation' : 'Primary escalation'}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Finishing acknowledgement</h1>
              <p className="mt-3 text-sm text-slate-400">{state.message}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-6 w-6 text-amber-300" />
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                Secure link status
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{state.title}</h1>
              <p className="mt-3 text-sm text-slate-400">{state.message}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-300" />
                <p className="text-sm text-slate-400">
                  This page intentionally stays inside the authenticated staff area. If the
                  secure link already succeeded once, retrying here is safe and should return
                  the acknowledged state instead of burning the token again.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  hasPostedRef.current = false
                  setState({
                    kind: 'loading',
                    message: 'Retrying the secure acknowledgement request...',
                  })
                  setRetryKey((current) => current + 1)
                }}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
              >
                Retry acknowledgement
              </button>
              <Link
                href={complaintId ? `/dashboard?context=${complaintId}` : '/dashboard'}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EscalationLandingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <EscalationLandingContent />
    </React.Suspense>
  )
}
