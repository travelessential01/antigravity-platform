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

function getNextPath(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get('next') || DEFAULT_NEXT_PATH
}

function buildChallengeHref(nextPath: string) {
  return `/auth/mfa/challenge?next=${encodeURIComponent(nextPath)}`
}

function MFAEnrollContent() {
  const [factorId, setFactorId] = useState('')
  const [secretString, setSecretString] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = getNextPath(searchParams)

  useEffect(() => {
    const enrollMfa = async () => {
      const supabase = createBrowserAuthClient()

      try {
        const { data: existing, error: factorError } = await supabase.auth.mfa.listFactors()
        if (factorError) {
          throw factorError
        }

        const verifiedFactor = existing?.all.find(
          (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
        )
        if (verifiedFactor) {
          router.replace(buildChallengeHref(nextPath))
          return
        }

        const unverifiedFactors = existing?.all.filter(
          (factor) => factor.factor_type === 'totp' && factor.status === 'unverified'
        ) ?? []

        for (const factor of unverifiedFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Authenticator App',
        })

        if (enrollError) {
          throw enrollError
        }

        if (!data?.totp?.secret) {
          throw new Error('Enrollment returned no secret key. Please refresh and try again.')
        }

        setFactorId(data.id)
        setSecretString(data.totp.secret)
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize MFA enrollment. Please refresh the page.'
        )
      } finally {
        setLoading(false)
      }
    }

    void enrollMfa()
  }, [nextPath, router])

  const handleVerify = async () => {
    if (!factorId) {
      setError('Authenticator setup is still loading. Please wait a moment and try again.')
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

      void postMfaAuditEvent('MFA Setup Completed', { factor_id: factorId }).catch(() => undefined)
      window.location.replace(nextPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.')
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
          <CardContent>
            <div className="h-32 w-full animate-pulse rounded bg-slate-100" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your account by linking an authenticator app such as Google Authenticator
            or Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-2 font-semibold text-slate-900">1. Add Account Manually</h3>
            <p className="mb-4 text-sm text-slate-600">
              Open your authenticator app, choose manual setup, and paste this secure key.
            </p>
            <div className="rounded border border-slate-300 bg-white p-3 text-center font-mono text-lg font-bold tracking-widest">
              {secretString}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">2. Verify Setup</h3>
            <p className="text-sm text-slate-600">
              Enter the 6-digit code from your authenticator app to confirm.
            </p>
            <Input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              className="h-12 text-center font-mono text-lg tracking-widest"
            />
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
          >
            {verifying ? 'Verifying...' : 'Complete Setup'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function MFAEnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <span className="animate-pulse text-slate-500">Loading authenticator setup...</span>
        </div>
      }
    >
      <MFAEnrollContent />
    </Suspense>
  )
}
