import { existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { destructiveTestsEnabled, requireDestructiveTestsEnabled } from '../helpers/destructive'

const execFileAsync = promisify(execFile)

async function docker(args: string[]) {
  const { stdout, stderr } = await execFileAsync('docker', args, { timeout: 120_000 })
  return `${stdout}${stderr}`.trim()
}

async function sql(query: string) {
  return docker([
    'exec',
    'supabase-db',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-t',
    '-A',
    '-c',
    query,
  ])
}

describe.skipIf(!destructiveTestsEnabled())('isolated disaster recovery simulation', () => {
  test('restores a dropped marker table from pg_dump inside the isolated DB', async () => {
    requireDestructiveTestsEnabled()

    const backupPath = path.join(os.tmpdir(), `stayassist-dr-${Date.now()}.dump`)
    const marker = `DR_MARKER_${Date.now()}`

    try {
      await sql(`
        DROP TABLE IF EXISTS public.dr_test_marker;
        CREATE TABLE public.dr_test_marker (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          marker_value TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        INSERT INTO public.dr_test_marker (marker_value) VALUES ('${marker}');
      `)

      await docker(['exec', 'supabase-db', 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-t', 'public.dr_test_marker', '-f', '/tmp/stayassist-dr.dump'])
      await docker(['cp', 'supabase-db:/tmp/stayassist-dr.dump', backupPath])
      expect(existsSync(backupPath)).toBe(true)

      await sql('DROP TABLE public.dr_test_marker;')
      const missingCount = await sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='dr_test_marker';")
      expect(Number(missingCount)).toBe(0)

      await docker(['cp', backupPath, 'supabase-db:/tmp/stayassist-dr-restore.dump'])
      await docker(['exec', 'supabase-db', 'pg_restore', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-acl', '/tmp/stayassist-dr-restore.dump'])

      const restoredMarker = await sql('SELECT marker_value FROM public.dr_test_marker LIMIT 1;')
      expect(restoredMarker).toBe(marker)
    } finally {
      await sql('DROP TABLE IF EXISTS public.dr_test_marker;').catch(() => undefined)
      await docker(['exec', 'supabase-db', 'rm', '-f', '/tmp/stayassist-dr.dump', '/tmp/stayassist-dr-restore.dump']).catch(() => undefined)
      if (existsSync(backupPath)) {
        rmSync(backupPath, { force: true })
      }
    }
  })
})
