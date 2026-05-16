# Supabase CLI Workdir

This directory is the permanent Supabase CLI workspace for this repo.

Canonical SQL migrations stay in `database/migrations/`. Supabase CLI expects
its own `supabase/migrations/` tree inside a workdir, so this workspace keeps a
 mirrored copy that is refreshed from the canonical source.

## Layout

- `supabase/config.toml`: tracked CLI configuration for this repo
- `supabase/migrations/`: mirrored numeric migrations used by the CLI
- `supabase/.temp/`: link metadata written by `supabase link` and ignored by git
- `../../scripts/sync-supabase-cli-workdir.mjs`: sync helper

## Workflow

1. Add a new migration under `database/migrations/`.
2. Run `pnpm supabase:sync-workdir`.
3. Run `pnpm supabase:db:push:dry-run`.
4. Run `pnpm supabase:db:push`.

## Notes

- Do not hand-edit files under `supabase/migrations/`.
- Seeds remain under `database/seeds/`; this workdir is focused on migration
  push/pull workflows.
- The linked project ref is stored in `supabase/.temp/` after linking and is
  intentionally not committed.
