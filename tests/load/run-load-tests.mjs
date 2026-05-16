import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const scripts = [
  'tests/load/k6_concurrent_submissions.js',
  'tests/load/k6_dashboard_readers.js',
  'tests/load/k6_thundering_herd.js',
]

if (process.env.RUN_K6_LOAD_TESTS !== 'true') {
  console.log('Skipping k6 load tests because RUN_K6_LOAD_TESTS=true is not set.')
  process.exit(0)
}

const k6 = process.env.K6_BIN || (existsSync('tests/load/k6.exe') ? 'tests/load/k6.exe' : 'k6')

for (const script of scripts) {
  const result = spawnSync(k6, ['run', script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
