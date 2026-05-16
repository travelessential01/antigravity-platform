'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createBrowserAuthClient } from '@/lib/supabase-client'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function IdleTimeout() {
    const pathname = usePathname()

    useEffect(() => {
        // Escape hatch for Patient Intake routes (HIPAA Exempt)
        if (pathname?.startsWith('/patient') || pathname?.startsWith('/login') || pathname?.startsWith('/auth')) {
            return
        }

        let timeoutId: NodeJS.Timeout

        const handleTimeout = async () => {
            console.warn('HIPAA Idle Timeout Reached. Logging out.')

            const supabase = createBrowserAuthClient()

            // 1. Log the timeout event to the backend (fire-and-forget for speed)
            supabase.from('audit_logs').insert({
                action: 'session_timeout',
                entity_type: 'user_session'
            }).then()

            // 2. Clear server-side auth context and best-effort sign out the browser client.
            await fetch('/api/auth/logout', {
                method: 'POST',
                cache: 'no-store',
            }).catch(() => undefined)
            await supabase.auth.signOut().catch(() => undefined)

            // 3. Force a full navigation so the next request starts with clean cookies.
            window.location.assign('/login?reason=idle_timeout')
        }

        const resetTimer = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(handleTimeout, IDLE_TIMEOUT_MS)
        }

        // Initialize Timer
        resetTimer()

        // Activity Listeners
        const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']
        events.forEach(event => window.addEventListener(event, resetTimer))

        return () => {
            clearTimeout(timeoutId)
            events.forEach(event => window.removeEventListener(event, resetTimer))
        }
    }, [pathname])

    return null // Headless component
}
