/**
 * (dpo)/layout.tsx — DPO Route Group Guard
 * Sprint A.7 — StayAssist V1 Session Governance
 *
 * Wraps the /investigator portal and any other DPO-only routes.
 * Enforces both ROLE + MFA (AAL2) before any page code runs.
 *
 * Allowed roles: DPO, Admin (with MFA challenge completed)
 * Auth flow:   requirePrivileged() → is_active check → role check → AAL2 check → render
 * On failure:  redirect with typed error parameter
 *
 * NOTE: requirePrivileged() = requireRole() + AAL2. No MFA = MFA_REQUIRED error even
 *       if role is correct. This prevents MFA bypass via direct URL navigation.
 */

import { requirePrivileged, AuthError } from '@/lib/auth-guard'
import { redirect } from 'next/navigation'

export default async function DPOLayout({
    children,
}: {
    children: React.ReactNode
}) {
    try {
        await requirePrivileged(['DPO', 'Admin'])
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
