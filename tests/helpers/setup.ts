import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue
    }

    const [key, ...valueParts] = line.split('=')
    const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '')
    process.env[key.trim()] ??= value
  }
}

process.env.NODE_ENV ??= 'test'
