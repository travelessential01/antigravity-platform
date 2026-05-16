import { describe, expect, test } from 'vitest'
import { canReachSupabase, createSupabaseAdmin, hasSupabaseCredentials } from '../helpers/supabase'

const forbiddenPhiFields = [
  'description',
  'reporter_name',
  'reporter_contact',
  'patient_name',
  'phone',
  'address',
  'diagnosis',
]

function expectNoPhiKeys(row: Record<string, unknown> | null | undefined, surface: string) {
  if (!row) {
    return
  }

  const keys = Object.keys(row)
  for (const field of forbiddenPhiFields) {
    expect(keys, `${surface} unexpectedly exposes PHI-like field '${field}'`).not.toContain(field)
  }
}

describe('HIPAA minimum necessary payload shape', () => {
  test('complaints table public workflow fields do not include PHI payload columns', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping live PHI shape check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .limit(1)
      .maybeSingle()

    expect(error).toBeNull()
    expectNoPhiKeys(data as Record<string, unknown> | null, 'complaints')
  })

  test('notifications do not duplicate patient or complaint PHI', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping live notification PHI shape check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1)
      .maybeSingle()

    expect(error).toBeNull()
    expectNoPhiKeys(data as Record<string, unknown> | null, 'notifications')
  })

  test('dashboard query shape is zero-PHI', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping dashboard PHI shape check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('complaints')
      .select('id,created_at,updated_at,status,severity_level,sla_deadline,department_id,departments(name)')
      .is('deleted_at', null)
      .neq('status', 'closed')
      .limit(1)
      .maybeSingle()

    expect(error).toBeNull()
    expectNoPhiKeys(data as Record<string, unknown> | null, 'dashboard complaints query')
  })
})
