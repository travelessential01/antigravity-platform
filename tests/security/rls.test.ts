import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { repoPath } from '../helpers/env'
import { canReachSupabase, expectNoRowsFromAnon, hasSupabaseCredentials } from '../helpers/supabase'

const requiredRlsTables = [
  'organizations',
  'hospitals',
  'departments',
  'users',
  'on_call_schedules',
  'sla_configurations',
  'complaints',
  'complaint_phi',
  'complaint_status_history',
  'audit_logs',
  'processed_events',
  'notifications',
  'sla_breach_log',
  'security_alerts',
  'patient_consents',
  'local_audit_reads',
  'user_department_assignments',
  'staff_session_context',
  'webauthn_credentials',
  'patients',
  'faqs',
  'complaint_severity_history',
]

const anonProtectedTables = [
  'users',
  'audit_logs',
  'complaint_phi',
  'security_alerts',
  'processed_events',
]

describe('database RLS protections', () => {
  test('migrations enable RLS on required public tables', () => {
    const migrationFiles = [
      '017_row_level_security.sql',
      '023_local_audit_reads.sql',
      '024_faqs.sql',
      '030_user_department_assignments.sql',
      '031_staff_session_context.sql',
      '032_webauthn_credentials.sql',
      '039_patients_table_staff_only_users.sql',
      '045_complaint_severity_history.sql',
    ]

    const migrationSql = migrationFiles
      .map((file) => readFileSync(repoPath('database', 'migrations', file), 'utf8'))
      .join('\n')
      .replace(/\s+/g, ' ')

    for (const table of requiredRlsTables) {
      expect(
        migrationSql,
        `Expected migrations to enable RLS for public.${table}`
      ).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`, 'i'))
    }
  })

  test('anonymous client cannot read protected tables', async () => {
    if (!hasSupabaseCredentials() || !await canReachSupabase()) {
      console.warn('Skipping live anonymous RLS checks because Supabase is not configured or reachable')
      return
    }

    for (const table of anonProtectedTables) {
      await expectNoRowsFromAnon(table)
    }
  })
})
