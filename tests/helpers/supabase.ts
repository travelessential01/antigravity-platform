import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { anonKey, serviceRoleKey, supabaseUrl } from './env'

export function hasSupabaseCredentials() {
  return Boolean(anonKey() && serviceRoleKey())
}

export async function canReachSupabase() {
  if (!hasSupabaseCredentials()) {
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)

  try {
    const response = await fetch(`${supabaseUrl()}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey()!,
        Authorization: `Bearer ${serviceRoleKey()}`,
      },
      signal: controller.signal,
    })

    return response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function createSupabaseAdmin(): SupabaseClient {
  const key = serviceRoleKey()
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or TEST_SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createSupabaseAnon(): SupabaseClient {
  const key = anonKey()
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or TEST_SUPABASE_ANON_KEY')
  }

  return createClient(supabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function expectNoRowsFromAnon(table: string, columns = 'id') {
  const supabase = createSupabaseAnon()
  const { data, error } = await supabase.from(table).select(columns).limit(5)

  if (error) {
    return
  }

  if ((data ?? []).length > 0) {
    throw new Error(`Anonymous client unexpectedly read ${data!.length} row(s) from ${table}`)
  }
}
