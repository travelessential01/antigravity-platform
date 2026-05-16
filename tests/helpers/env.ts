import { existsSync } from 'node:fs'
import path from 'node:path'

export const projectRoot = path.resolve(process.cwd())

export function env(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : undefined
}

export function requiredEnv(name: string): string {
  const value = env(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function appBaseUrl() {
  return env('TEST_APP_URL') ?? env('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000'
}

export function supabaseUrl() {
  return env('TEST_SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL') ?? 'http://localhost:8000'
}

export function anonKey() {
  return env('TEST_SUPABASE_ANON_KEY') ?? env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function serviceRoleKey() {
  return env('TEST_SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY')
}

export function redisUrl() {
  return env('TEST_REDIS_URL') ?? env('REDIS_URL')
}

export function elasticsearchUrl() {
  return env('TEST_ELASTICSEARCH_URL') ?? env('ELASTICSEARCH_URL')
}

export function skipReason(missing: string[]) {
  return `Skipped because these required env vars are missing: ${missing.join(', ')}`
}

export function hasEnv(names: string[]) {
  return names.every((name) => Boolean(env(name)))
}

export function testDataPrefix() {
  return env('TEST_DATA_PREFIX') ?? `stayassist-test-${process.pid}`
}

export function repoPath(...parts: string[]) {
  return path.join(projectRoot, ...parts)
}

export function fileExists(...parts: string[]) {
  return existsSync(repoPath(...parts))
}
