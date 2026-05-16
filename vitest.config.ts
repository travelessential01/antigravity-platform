import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

process.env.TMPDIR ??= '/tmp'
process.env.TMP ??= '/tmp'
process.env.TEMP ??= '/tmp'

export default defineConfig({
  cacheDir: '/tmp/stayassist-vite-cache',
  plugins: [tsconfigPaths({ ignoreConfigErrors: true, projects: ['./tsconfig.json'] })],
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'supabase/**', '.next/**'],
    globals: true,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./tests/helpers/setup.ts'],
    testTimeout: 30_000,
  },
})
