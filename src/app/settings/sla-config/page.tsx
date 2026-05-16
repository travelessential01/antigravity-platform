import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { SlaConfigClient } from './SlaConfigClient'
import { requirePrivileged, AuthError } from '@/lib/auth-guard'

export const metadata: Metadata = {
  title: 'SLA Configuration | StayAssist Admin',
  description: 'Manage clinical response Service Level Agreement thresholds.',
}

export default async function SlaConfigPage() {
  try {
    await requirePrivileged(['Admin'])
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'UNAUTHORIZED') redirect('/login')
      if (error.code === 'DEACTIVATED') redirect('/login?error=deactivated')
      if (error.code === 'FORBIDDEN') redirect('/dashboard?error=forbidden')
      if (error.code === 'MFA_REQUIRED') redirect('/auth/mfa/challenge')
    }

    redirect('/login')
  }

  return (
    <PageShell
      eyebrow="Admin Settings"
      title="SLA Configuration Center"
      description="Define global operational constraints for zero-PHI intake escalations."
      contentClassName="max-w-3xl"
    >
      <SlaConfigClient />
    </PageShell>
  )
}
