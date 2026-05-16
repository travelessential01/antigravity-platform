'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { postMfaAuditEvent } from '@/lib/mfa-audit-client'
import { createBrowserAuthClient } from '@/lib/supabase-client'

const DEFAULT_NEXT_PATH = '/auth/post-login'

function buildEnrollHref(nextPath: string) {
  return `/auth/mfa/enroll?next=${encodeURIComponent(nextPath)}`
}

function MFAChallengeContent() {
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || DEFAULT_NEXT_PATH

  useEffect(() => {
    const checkFactors = async () => {
      const supabase = createBrowserAuthClient()

      try {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors()
        if (factorError) {
          throw factorError
        }

        const totpFactor = factors?.all.find(
          (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
        )

        if (totpFactor) {
          setFactorId(totpFactor.id)
        } else {
          router.replace(buildEnrollHref(nextPath))
        }
      } catch {
        setError('Failed to load authentication factors. Please contact IT.')
      } finally {
        setLoading(false)
      }
    }

    void checkFactors()
  }, [nextPath, router])

  const handleVerify = async () => {
    if (!factorId) {
      setError('Authentication factor not loaded yet. Please wait a moment and try again.')
      return
    }

    setVerifying(true)
    setError('')

    const supabase = createBrowserAuthClient()

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) {
        throw challenge.error
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      })
      if (verify.error) {
        throw verify.error
      }

      await supabase.auth.setSession({
        access_token: verify.data.access_token,
        refresh_token: verify.data.refresh_token,
      })

      void postMfaAuditEvent('MFA Challenge Passed', { factor_id: factorId }).catch(() => undefined)
      window.location.replace(nextPath)
    } catch (err: unknown) {
      void postMfaAuditEvent('MFA Challenge Failed', {
        factor_id: factorId,
        attempt_code: 'REDACTED',
      }).catch(() => undefined)

      setError(err instanceof Error ? err.message : 'Invalid authenticator code. Try again.')
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200" />
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-blue-600 shadow-lg">
        <CardHeader>
          <CardTitle>Security Challenge</CardTitle>
          <CardDescription>
            Your role requires multi-factor authentication. Enter the current code from your
            authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="000 000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            className="h-16 bg-white text-center font-mono text-3xl tracking-widest"
          />
          {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

          <Button
            className="h-12 w-full text-lg font-semibold"
            onClick={handleVerify}
            disabled={verifying || code.length !== 6 || !factorId}
          >
            {verifying ? 'Authenticating...' : 'Verify Access'}
          </Button>
        </CardContent>
        <CardFooter className="mt-4 rounded-b-xl border-t bg-slate-50 pt-4">
          <p className="w-full text-center text-xs text-slate-500">
            Complete the authenticator challenge to continue to your protected workspace.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function MFAChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <span className="animate-pulse text-slate-500">Loading security check...</span>
        </div>
      }
    >
      <MFAChallengeContent />
    </Suspense>
  )
}
