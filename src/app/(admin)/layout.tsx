/**
 * (admin)/layout.tsx - Admin Route Group Guard
 * Sprint A.7 - StayAssist V1 Session Governance
 *
 * Wraps all routes under /org-dashboard, /faq-management, and /settings.
 * Enforces both role and MFA before any page code runs.
 *
 * Allowed roles: Admin, Medical Superintendent
 * Auth flow: requirePrivileged() -> is_active check -> role check -> AAL2 check -> render
 * On failure: redirect to /login (UNAUTHORIZED/DEACTIVATED), /dashboard (FORBIDDEN),
 * or /auth/mfa/challenge (MFA_REQUIRED).
 */

import { requirePrivileged, AuthError } from '@/lib/auth-guard'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await requirePrivileged(['Admin', 'Medical Superintendent'])
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'UNAUTHORIZED') redirect('/login')
      if (error.code === 'DEACTIVATED') redirect('/login?error=deactivated')
      if (error.code === 'FORBIDDEN') redirect('/dashboard?error=forbidden')
      if (error.code === 'MFA_REQUIRED') redirect('/auth/mfa/challenge')
    }

    redirect('/login')
  }

  return <>{children}</>
}
