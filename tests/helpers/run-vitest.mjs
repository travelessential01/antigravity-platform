import { spawnSync } from 'node:child_process'
import os from 'node:os'

const fallbackTemp = process.platform === 'win32' ? os.tmpdir() : '/tmp'
const env = {
  ...process.env,
  TMPDIR: process.env.TMPDIR || fallbackTemp,
  TEMP: process.env.TEMP || fallbackTemp,
  TMP: process.env.TMP || fallbackTemp,
}

const result = spawnSync('pnpm', ['exec', 'vitest', ...process.argv.slice(2)], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
