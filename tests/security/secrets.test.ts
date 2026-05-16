import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { env, projectRoot, repoPath } from '../helpers/env'

const scanRoots = ['src', 'tests', 'scripts', 'execution', 'database/migrations']
const ignoredPathFragments = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}tests${path.sep}load${path.sep}k6.exe`,
  `${path.sep}tests${path.sep}security${path.sep}secrets.test.ts`,
]

const secretChecks: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS access key', pattern: /AKIA[A-Z0-9]{16}/ },
  { name: 'private key', pattern: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { name: 'hardcoded Supabase JWT', pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Elasticsearch default password', pattern: /ELASTICSEARCH_PASSWORD\s*=\s*changeme/i },
  { name: 'placeholder secret assignment', pattern: /(JWT_SECRET|AUTHENTIK_SECRET_KEY|ACKNOWLEDGE_LINK_SECRET)\s*=\s*(changeme|temporary|development|test-secret)/i },
]

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return []
  }

  const stat = statSync(root)
  if (stat.isFile()) {
    return [root]
  }

  return readdirSync(root).flatMap((entry) => {
    const fullPath = path.join(root, entry)
    if (ignoredPathFragments.some((fragment) => fullPath.includes(fragment))) {
      return []
    }

    const entryStat = statSync(fullPath)
    if (entryStat.isDirectory()) {
      return listFiles(fullPath)
    }

    return fullPath
  })
}

describe('secrets hygiene', () => {
  test('source and test files do not contain hardcoded secrets', () => {
    const files = scanRoots.flatMap((root) => listFiles(repoPath(root)))
    const failures: string[] = []

    for (const file of files) {
      if (!/\.(ts|tsx|js|mjs|cjs|ps1|py|sql|json|yml|yaml)$/.test(file)) {
        continue
      }

      const content = readFileSync(file, 'utf8')
      for (const check of secretChecks) {
        if (check.pattern.test(content)) {
          failures.push(`${path.relative(projectRoot, file)}: ${check.name}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  test('production mode rejects a repo-root .env file', () => {
    if (env('TEST_PRODUCTION_MODE') !== 'true') {
      return
    }

    expect(existsSync(repoPath('.env')), '.env must not be present during production-mode test runs').toBe(false)
  })
})
