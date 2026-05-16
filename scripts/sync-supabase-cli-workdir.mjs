import { mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(repoRoot, 'database', 'migrations')
const targetDir = path.join(repoRoot, 'database', 'supabase-cli', 'supabase', 'migrations')
const migrationPattern = /^\d{3}_.+\.sql$/i

async function listMigrationFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && migrationPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

async function main() {
  await mkdir(targetDir, { recursive: true })

  const sourceFiles = await listMigrationFiles(sourceDir)
  const targetFiles = await listMigrationFiles(targetDir)
  const sourceSet = new Set(sourceFiles)

  for (const staleFile of targetFiles) {
    if (!sourceSet.has(staleFile)) {
      await rm(path.join(targetDir, staleFile), { force: true })
    }
  }

  for (const file of sourceFiles) {
    await copyFile(path.join(sourceDir, file), path.join(targetDir, file))
  }

  console.log(`Synced ${sourceFiles.length} migration files into database/supabase-cli/supabase/migrations.`)
}

main().catch((error) => {
  console.error('Failed to sync Supabase CLI workdir migrations.')
  console.error(error)
  process.exitCode = 1
})
