import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { env, repoPath } from '../helpers/env'
import { canReachSupabase, createSupabaseAdmin, hasSupabaseCredentials } from '../helpers/supabase'

const execFileAsync = promisify(execFile)

const requiredTables = [
  'organizations',
  'hospitals',
  'departments',
  'users',
  'complaints',
  'complaint_phi',
  'complaint_status_history',
  'audit_logs',
  'processed_events',
  'notifications',
  'sla_breach_log',
  'patient_consents',
]

const materializedViews = [
  'mv_avg_resolution_time',
  'mv_monthly_complaint_trends',
  'mv_sla_compliance_percentage',
  'mv_department_heatmap',
  'mv_capa_effectiveness',
  'mv_org_sla_compliance',
  'mv_org_complaint_trends',
  'mv_org_resolution_benchmarks',
]

describe('database and workflow health', () => {
  test('required workflow tables are queryable with admin setup credentials', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping live table health check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    for (const table of requiredTables) {
      const { error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .limit(1)

      expect(error, `Expected ${table} to be queryable`).toBeNull()
    }
  })

  test('materialized views are declared in migrations and queryable when DB is configured', async () => {
    const migration = readFileSync(repoPath('database', 'migrations', '020_materialised_views.sql'), 'utf8')

    for (const view of materializedViews) {
      expect(migration).toContain(`public.${view}`)
    }

    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping live materialized view query because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    for (const view of materializedViews) {
      const { error } = await supabase
        .from(view)
        .select('*', { count: 'exact', head: true })
        .limit(1)

      expect(error, `Expected ${view} to be queryable`).toBeNull()
    }
  })

  test('processed_events enforces idempotency through unique event IDs', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping processed_events idempotency check because Supabase is not configured or reachable')
      return
    }

    const supabase = createSupabaseAdmin()
    const eventId = `test:${crypto.randomUUID()}`
    const payload = { source: 'vitest', eventId }

    const first = await supabase
      .from('processed_events')
      .insert({ event_id: eventId, event_name: 'test/idempotency', payload })

    expect(first.error).toBeNull()

    const duplicate = await supabase
      .from('processed_events')
      .insert({ event_id: eventId, event_name: 'test/idempotency', payload })

    expect(duplicate.error?.message.toLowerCase()).toMatch(/duplicate|unique/)

    await supabase.from('processed_events').delete().eq('event_id', eventId)
  })

  test('SLA breach backfill script supports a non-mutating dry-run path', async () => {
    const script = readFileSync(repoPath('scripts', 'backfill-sla-breaches.mjs'), 'utf8')
    expect(script).toContain('--dry-run')
    expect(script).toMatch(/dryRun|dry-run/i)

    if (env('RUN_SLA_DRY_RUN_TEST') !== 'true') {
      console.warn('Skipping live SLA dry-run execution because RUN_SLA_DRY_RUN_TEST=true is not set')
      return
    }

    const { stdout, stderr } = await execFileAsync(
      'node',
      [
        '--experimental-strip-types',
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        repoPath('scripts', 'backfill-sla-breaches.mjs'),
        '--dry-run',
        '--limit',
        '1',
      ],
      { cwd: repoPath() }
    )

    expect(`${stdout}${stderr}`).toMatch(/dry|overdue|complaint|no/i)
  })
})
