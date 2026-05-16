/**
 * (staff)/layout.tsx — Staff Route Group Guard
 * Sprint A.7 — StayAssist V1 Session Governance
 *
 * Wraps the /dashboard and any other authenticated-staff routes.
 * Enforces active session + is_active check before any page code runs.
 *
 * Auth flow:   requireUser() → session check → is_active DB check → render children
 * On failure:  redirect to /login (UNAUTHORIZED) or /login?error=deactivated (DEACTIVATED)
 *
 * NOTE: Role is NOT enforced here — all authenticated, active staff can access
 *       the staff dashboard. Role-gated sub-sections are handled deeper in the tree.
 */

import { requireUser, AuthError } from '@/lib/auth-guard'
import { redirect } from 'next/navigation'

export default async function StaffLayout({
    children,
}: {
    children: React.ReactNode
}) {
    try {
        await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            if (error.code === 'UNAUTHORIZED') redirect('/login')
            if (error.code === 'DEACTIVATED') redirect('/login?error=deactivated')
        }
        redirect('/login')
    }

    return <>{children}</>
}
