# Technical Audit Claim Matrix

**Source report:** `C:\Users\ARPAN\.gemini\antigravity\brain\403d8647-4ef1-412d-809e-4b737475f18b\technical_audit.md.resolved`
**Re-audit date:** 2026-04-27
**Source of truth:** Current workspace snapshot in `C:\Application V4.0`

## Verdict

The original report is **partially genuine but not reliable as a final authority**.

- It correctly identified several real files, controls, and weaknesses.
- It overstates the effectiveness of some controls.
- It misses multiple higher-impact runtime and schema issues in the current repo.
- A number of statements are directionally right but imprecise, stale, or unsupported by the current tree.

## Status Legend

- `Verified` - Reproduces directly in the current repo.
- `Partially verified` - Core concern is real, but the report is incomplete, overstated, or imprecise.
- `Unsupported in current repo` - Could not be substantiated from the current workspace.
- `Stale/uncertain` - May have been true at report time, but current repo evidence does not support a confident current-state verdict.

## Claim Matrix

| ID | Original report claim | Current status | Evidence in current repo | Current assessment |
|---|---|---|---|---|
| C-01 | Stack header is accurate: Next.js 16, React 19, Supabase, Inngest, Redis, Sentry | Verified | `package.json` lists `next@16.1.6`, `react@19.2.3`, `inngest`, `ioredis`, `@supabase/*`, `@sentry/nextjs` | The stack summary is real. |
| C-02 | Architecture counts are accurate: 13 API routes, 5 server actions, 5 jobs, 32 migrations | Partially verified | `database/migrations` contains 32 files; `src/inngest/functions.ts` defines 5 functions; current `src/app/api` surface is larger than 13 routes | The migration and Inngest counts hold, but the API route count is understated in the current repo. |
| C-03 | Centralized auth guard and DB-backed role resolution exist | Verified | `src/lib/auth-guard.ts` resolves session, then loads `public.users.role` with a service-role client | This is one of the report's stronger claims. |
| C-04 | MFA enforcement is "strong" | Partially verified | `requirePrivileged()` checks `aal2`, but `src/app/(admin)/layout.tsx` uses `requireRole()` only | MFA infrastructure exists, but enforcement is not uniformly applied across privileged surfaces. |
| C-05 | Layout-level guards are correctly wired | Partially verified | Guard files exist, but several allowed-role literals use display labels like `Medical Superintendent` while DB roles are snake_case such as `medical_superintendent` | The files are present, but intended access for some roles is broken by string mismatch. |
| C-06 | Protected API routes consistently use shared helper guards | Partially verified | Many routes call `requireApiRole()` / `requireApiPrivileged()`, but route accessibility is undermined by role-label mismatch and proxy behavior | The helper pattern exists, but "protected correctly" is too strong. |
| C-07 | RLS helper functions with `SET search_path = public` are present | Verified | `database/migrations/036_security_alignment.sql` contains multiple `SET search_path = public` helpers | This reproduces cleanly. |
| C-08 | Hospital scope enforcement for `quality_coordinator` exports is correct | Partially verified | Export routes check `user.role === "quality_coordinator"` after auth, but auth allows `"Quality Coordinator"` instead of `quality_coordinator` | Scope checks exist, but intended QC access can fail before scope logic runs. |
| C-09 | `supabase-admin.ts` is server-only isolated | Verified | `src/lib/supabase-admin.ts` imports `server-only` | The isolation claim is correct. |
| C-10 | PHI encryption, key versioning, and local read logging exist | Verified | `src/actions/complaints.ts` encrypts with AES-GCM, checks `key_version`, and inserts into `local_audit_reads` | Core data-protection mechanisms are present in code. |
| C-11 | Client-side JWT encryption exists | Verified | `src/lib/encrypted-storage.ts` implements AES-GCM storage and `src/lib/supabase-client.ts` uses it | The mechanism exists in the current repo. |
| C-12 | Deep-link security is "strong" | Partially verified | `src/lib/acknowledgement-links.ts` signs tokens and uses `timingSafeEqual`; `src/app/api/acknowledge/route.ts` uses replay and issuance checks; `src/proxy.ts` does not mark `/api/acknowledge` public | Token controls are real, but the anonymous flow is blocked by proxy auth. |
| C-13 | Rate-limiting coverage is adequately described | Partially verified | Complaint and acknowledge limiters exist; OTP request is unthrottled; OTP verify is also unthrottled and not mentioned in the report | The report found one gap but missed the full abuse surface. |
| C-14 | SA-001: No rate limiting on `/api/auth/otp/request` | Verified | `src/app/api/auth/otp/request/route.ts` has no call to a rate limiter | This finding stands. |
| C-15 | SA-002: `.env` and `API KEYS` contain production secrets | Partially verified | Both `.env` and `API KEYS` exist at repo root and contain secret-bearing variables and values | Secret-bearing files definitely exist; "production" provenance cannot be proved from static repo inspection alone. |
| C-16 | SA-003: Hardcoded 10-minute SLA override | Verified | `src/actions/complaints.ts:248` sends `clinicalSlaMinutes: 10` | This finding stands and directly affects workflow timing. |
| C-17 | SA-004: Patient intake uses mock OTP `0000` | Verified | `src/app/(patient)/intake/IntakeForm.tsx` accepts `0000` and renders a dev bypass banner | This is a real production-path weakness. |
| C-18 | SA-005: Sentry DSN falls back to a placeholder | Verified | `sentry.server.config.ts`, `sentry.edge.config.ts`, and `instrumentation-client.ts` all fall back to `sentry.example.com` | This finding stands. |
| C-19 | SA-006: `console.log` remnants in 6 files | Partially verified | Console statements are present in the cited areas, but the report misstates both the count and the method names (`console.error/info/warn` are used, not only `console.log`) | The hygiene issue is real, but the report is imprecise. |
| C-20 | SA-007: Device fingerprinting uses a weak shift-hash | Verified | `src/lib/login-risk.ts` uses a simple integer rolling hash and even comments that a proper hash should be used in production | This finding stands. |
| C-21 | SA-008: No CSRF protection on state-mutating API routes | Partially verified | Cookie-authenticated POST routes do not perform explicit origin or CSRF-token checks; `/api/acknowledge` is token-authenticated, not session-cookie-only | The broader concern is real, but the report overgeneralizes one example. |
| C-22 | SA-009: Hardcoded sentinel department ID | Verified | `src/app/(patient)/intake/IntakeForm.tsx` hardcodes `026ba7dc-f589-4386-8f57-3eba092b1de1`; seeds document a different anonymous department ID `636fb19e-f53c-42d7-ace6-da882600d481` | This is real and more severe than the original report suggests. |
| C-23 | SA-010: Two separate Redis connections for rate limiting | Verified | `src/lib/rate-limit.ts` and `src/lib/rate-limit-acknowledge.ts` each instantiate `new Redis(...)` | The duplication is real. |
| C-24 | SA-011: `tracesSampleRate: 1` in Sentry | Verified | `sentry.server.config.ts` and `sentry.edge.config.ts` set `tracesSampleRate: 1` | This finding stands. |
| C-25 | Migration chain summary and missing `025-028` are accurate | Partially verified | There are 32 files in `database/migrations` and 025-028 are absent; no `030b_backfill_assignments.sql` exists in the current repo | The numbering gap is real, but the "intentionally removed" backstory cannot be verified from the current snapshot. |
| C-26 | API route protection matrix is accurate | Partially verified | General route list is close, but `/api/acknowledge` is not actually public in practice because proxy omits it from `PUBLIC_PATTERNS`, and role literals such as `Medical Superintendent` do not match DB role names | The matrix is useful as a rough map, not as a trustworthy enforcement description. |
| C-27 | SA-012: `sla/config-updated` is a dead event | Verified | `src/actions/sla.ts` sends `sla/config-updated`; `src/inngest/client.ts` defines it; `src/inngest/functions.ts` has no handler for it | This finding stands. |
| C-28 | SA-013: No readiness probe | Verified | `src/app/api/health/route.ts` always returns service metadata and does not check Supabase, Redis, or Elasticsearch | This finding stands. |
| C-29 | "Zero automated test coverage" is the largest production risk | Partially verified | The app package has no unit-test script and the main checks here are `pnpm lint` and `npx tsc --noEmit`, but the repo does contain PowerShell and k6 test artifacts | The app lacks a modern automated test harness, but "zero automated test coverage" is too absolute. |
| C-30 | Overall conclusion: security architecture is excellent and overall grade is B / 7.0 | Unsupported in current repo | Multiple higher-impact gaps were missed, including auth gating, route pathing, anonymous intake schema drift, and audit/schema incompatibilities | The final score is too optimistic for the current workspace. |

## Bottom Line

- The report is **not fabricated**, because many cited files and several specific findings are real.
- The report is **not reliable enough to accept at face value**, because it misses multiple more serious runtime issues and overstates control effectiveness in auth, routing, and audit logging.
- It is best used as a **rough artifact inventory plus a partial finding list**, not as the authoritative audit for the current repo.
