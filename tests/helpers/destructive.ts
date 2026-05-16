import { appBaseUrl, env, supabaseUrl } from './env'

function isLocalOrAllowed(url: string) {
  const parsed = new URL(url)
  const allowedHosts = (env('DESTRUCTIVE_TEST_ALLOWED_HOSTS') ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    allowedHosts.includes(parsed.hostname)
  )
}

export function destructiveTestsEnabled() {
  return (
    env('ALLOW_DESTRUCTIVE_TESTS') === 'true' &&
    env('TEST_ENVIRONMENT') === 'isolated' &&
    isLocalOrAllowed(appBaseUrl()) &&
    isLocalOrAllowed(supabaseUrl())
  )
}

export function requireDestructiveTestsEnabled() {
  if (!destructiveTestsEnabled()) {
    throw new Error(
      [
        'Destructive tests are disabled.',
        'Required: ALLOW_DESTRUCTIVE_TESTS=true, TEST_ENVIRONMENT=isolated, and localhost or DESTRUCTIVE_TEST_ALLOWED_HOSTS.',
      ].join(' ')
    )
  }
}
