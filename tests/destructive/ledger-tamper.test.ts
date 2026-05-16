import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { destructiveTestsEnabled, requireDestructiveTestsEnabled } from '../helpers/destructive'

const execFileAsync = promisify(execFile)

async function sql(query: string) {
  const { stdout, stderr } = await execFileAsync('docker', [
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

  return `${stdout}${stderr}`.trim()
}

describe.skipIf(!destructiveTestsEnabled())('isolated ledger tamper simulation', () => {
  test('audit_logs blocks direct UPDATE and preserves the hash chain', async () => {
    requireDestructiveTestsEnabled()

    const targetId = await sql('SELECT id FROM public.audit_logs ORDER BY created_at DESC LIMIT 1;')
    if (!targetId) {
      console.warn('Skipping ledger tamper simulation because audit_logs has no rows')
      return
    }

    const originalAction = await sql(`SELECT action_type FROM public.audit_logs WHERE id = '${targetId}';`)

    let tamperOutput = ''
    try {
      tamperOutput = await sql(`UPDATE public.audit_logs SET action_type = 'TAMPER_DETECTED' WHERE id = '${targetId}';`)
    } catch (error) {
      tamperOutput = String(error)
    }

    expect(tamperOutput.toLowerCase()).toMatch(/tamper|permission denied|cannot|denied|error/)

    const currentAction = await sql(`SELECT action_type FROM public.audit_logs WHERE id = '${targetId}';`)
    expect(currentAction).toBe(originalAction)

    const mismatches = await sql(`
      SELECT COUNT(*) FROM (
        SELECT id, ledger_hash, previous_hash,
               LAG(ledger_hash) OVER (ORDER BY created_at, id) AS expected_previous
        FROM public.audit_logs
      ) sub
      WHERE previous_hash IS NOT NULL
        AND expected_previous IS NOT NULL
        AND previous_hash != expected_previous;
    `)

    expect(Number(mismatches)).toBe(0)
  })
})
