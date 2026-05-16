import { createBrowserClient } from '@supabase/ssr'

/**
 * Shared browser auth client.
 *
 * This app now standardizes on the same cookie-backed auth model that the
 * Next.js proxy and server-side guards read, which keeps client and SSR auth
 * state in sync across OTP, MFA, and dashboard navigation.
 */
export const createBrowserAuthClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables! Ensure NEXT_PUBLIC_SUPABASE_URL is set.')
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Legacy alias kept temporarily so older callsites continue to compile while
// the app is migrated onto the shared browser auth client.
export const createEncryptedBrowserClient = createBrowserAuthClient
