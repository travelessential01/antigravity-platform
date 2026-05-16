# Technical Re-Audit

**Scope:** Current workspace snapshot in `C:\Application V4.0`
**Date:** 2026-04-27
**Original report reviewed:** `technical_audit.md.resolved`

## Executive Summary

The original audit captured several real issues, but it missed multiple higher-impact problems that change the current risk picture materially.

The most important current-state issues are:

- Anonymous patient intake is inconsistent with both the database schema and the seeded department IDs.
- Mock OTP mode can become the effective production auth path whenever the server-side flag is not exactly `true`.
- Audit and security telemetry writers are out of sync with the database schemas they target.
- The staff login flow hardcodes `/staff/...` paths that do not exist in the App Router.
- Several role-gated routes use display labels instead of the snake_case roles stored in the database.
- The public secure-link acknowledge flow is blocked by proxy auth before it reaches the handler.

## Checks Run

- Direct repo inspection and targeted `rg` searches
- `pnpm lint`
- `npx tsc --noEmit`

### Check results

- `pnpm lint` passed with 3 warnings in `execution/` helper scripts, no lint errors in the main app surface.
- `npx tsc --noEmit` completed successfully.
- No dedicated app test runner is configured in `package.json`.

## Findings

### RA-001 - Anonymous patient intake is inconsistent with schema and seed data
**Severity:** Critical

**Evidence**

- `src/app/(patient)/intake/IntakeForm.tsx` submits complaints with a hardcoded `ANONYMOUS_DEPT_ID` of `026ba7dc-f589-4386-8f57-3eba092b1de1`.
- `database/seeds/add_new_facility_seed.sql` documents the anonymous department as `636fb19e-f53c-42d7-ace6-da882600d481`.
- `database/migrations/007_complaints.sql` still enforces both:
  - `department_id UUID NOT NULL REFERENCES public.departments(id)`
  - `patient_id UUID NOT NULL REFERENCES public.users(id)`
- `src/actions/complaints.ts` generates a hashed patient UUID and inserts it directly; it does not create a corresponding `public.users` row.

**Impact**

- Patient complaint creation is likely to fail in the seeded environment even before considering business logic.
- The app code comments claim anonymous patient support, but the current schema does not match that claim.

**Why this matters more than the original report**

- The original report noted the hardcoded department UUID.
- It did **not** connect that UUID drift to the still-active foreign keys on `complaints.department_id` and `complaints.patient_id`.
- In the current repo, this is a core-flow correctness problem, not a low-severity configuration smell.

### RA-002 - Mock OTP mode can become the effective production auth path
**Severity:** Critical

**Evidence**

- `src/app/api/auth/otp/request/route.ts` and `src/app/api/auth/otp/verify/route.ts` enable live OTP only when `SUPABASE_PHONE_OTP_ENABLED === 'true'`.
- Otherwise, verify mode accepts the universal OTP `000000`.
- `src/app/login/page.tsx` and `src/app/auth/otp/verify/page.tsx` check a **different** flag: `NEXT_PUBLIC_SUPABASE_PHONE_OTP_ENABLED`.
- The current root `.env` exposes `SUPABASE_PHONE_OTP_ENABLED` but not the public `NEXT_PUBLIC_...` variant.

**Impact**

- If the server-side flag is absent, misspelled, or not exactly `true`, universal OTP login is active.
- The client and server can disagree about whether the system is in mock mode, which increases operator error risk and makes deployments harder to reason about.

**Why this matters more than the original report**

- The original report correctly flagged the patient `0000` bypass and missing OTP-request throttling.
- It did **not** elevate the staff-side `000000` fallback, which is the more serious authentication risk.

### RA-003 - Audit and security telemetry writers do not match the database schemas
**Severity:** Critical

**Evidence**

- `database/migrations/010_audit_logs.sql` defines `audit_logs` as:
  - `table_name`
  - `record_id`
  - `action_type`
  - `old_data`
  - `new_data`
  - `performed_by`
- `src/actions/audit.ts` inserts incompatible fields such as `action`, `actor_id`, `entity_type`, and `entity_id`.
- `src/inngest/functions.ts` also inserts incompatible `audit_logs` fields inside `capa30DayCheckpoint`.
- `database/migrations/014_security_alerts.sql` defines `security_alerts` with:
  - `alert_type`
  - `source_table`
  - `source_record_id`
  - `details`
- `src/lib/login-risk.ts` inserts incompatible fields such as `user_id`, `description`, and `metadata`, and uses `alert_type` values like `login_ok` and `login_risk_medium` that are not in the migration check constraint.

**Impact**

- MFA audit logging, CAPA checkpoint logging, and login-risk event logging are all at risk of runtime failure or silent non-delivery.
- This undermines the original report's positive conclusions about audit integrity and observability.

### RA-004 - Staff auth and post-login routing hardcode `/staff/...` paths that do not exist
**Severity:** High

**Evidence**

- The actual pages live in the App Router route group `src/app/(staff)/...`, which maps to `/dashboard` and `/select-department`, not `/staff/dashboard` or `/staff/select-department`.
- Hardcoded `/staff/...` redirects are present in:
  - `src/app/login/page.tsx`
  - `src/app/auth/otp/verify/page.tsx`
  - `src/app/auth/biometric/challenge/page.tsx`
  - `src/app/auth/biometric/register/page.tsx`
  - `src/app/(staff)/select-department/page.tsx`

**Impact**

- Existing-session redirect, post-OTP redirect, post-biometric redirect, and department-selection redirect can all point to non-existent routes.
- This is a user-facing availability break in the auth flow.

**Why this matters**

- The original report did not mention routing correctness at all.
- In practice, this can block login even if the auth primitives themselves succeed.

### RA-005 - Role normalization mismatch breaks intended authorization for non-admin roles
**Severity:** High

**Evidence**

- `src/lib/auth-guard.ts` lowercases roles but does not normalize spaces vs underscores.
- Database seeds and migrations use snake_case roles such as:
  - `quality_coordinator`
  - `medical_superintendent`
  - `department_manager`
- Several routes and layouts allow human-readable labels instead:
  - `src/app/(admin)/layout.tsx`
  - `src/app/api/export-pdf/route.ts`
  - `src/app/api/accreditation/export/route.ts`
  - `src/app/api/qr/generate/route.ts`
  - `src/app/api/escalation/resolve/route.ts`

**Impact**

- Users with legitimate `quality_coordinator` or `medical_superintendent` roles can be denied access to intended areas.
- The original report's "authorization strong" conclusion is overstated for the current repo.

### RA-006 - `/api/acknowledge` is designed as a public secure-link endpoint but blocked by proxy auth
**Severity:** High

**Evidence**

- `src/app/api/acknowledge/route.ts` is implemented as an anonymous token-based handler and documents itself as public.
- `src/proxy.ts` redirects unauthenticated requests unless the path matches `PUBLIC_PATTERNS`.
- `PUBLIC_PATTERNS` do not include `/api/acknowledge`.

**Impact**

- Secure acknowledgement links can redirect to `/login` before token verification ever happens.
- This breaks the intended "one-click acknowledge" flow and can interfere with SLA acknowledgment handling.

### RA-007 - MFA is not consistently enforced where docs and comments claim it is mandatory
**Severity:** High

**Evidence**

- `src/lib/auth-guard.ts` supports `requirePrivileged()` with `aal2`.
- `src/app/(dpo)/layout.tsx` uses `requirePrivileged()`.
- `src/app/(admin)/layout.tsx` uses `requireRole()` only, not `requirePrivileged()`.
- Several report/export routes use `requireApiRole()` rather than `requireApiPrivileged()`.
- `src/app/(admin)/faq-management/page.tsx` states that privileged roles must complete MFA before protected actions are allowed.

**Impact**

- Current enforcement is inconsistent with the stated security model.
- Some privileged surfaces can be accessed without the AAL2 guarantee implied by the docs.

### RA-008 - OTP abuse controls are incomplete
**Severity:** High

**Evidence**

- `src/app/api/auth/otp/request/route.ts` has no rate limiter.
- `src/app/api/auth/otp/verify/route.ts` has no rate limiter.
- `src/lib/login-risk.ts` models `consecutiveFailures`, but `src/app/api/auth/otp/verify/route.ts` passes `consecutiveFailures: 0` every time.

**Impact**

- OTP request can be abused for cost amplification.
- OTP verify can be brute-forced more easily than the current report implies.
- The risk-scoring system exists, but one of its stated signals is not actually wired in.

### RA-009 - Observability defaults remain risky in production
**Severity:** Medium

**Evidence**

- `sentry.server.config.ts` and `sentry.edge.config.ts` use:
  - placeholder DSN fallbacks
  - `tracesSampleRate: 1`
- `src/app/api/health/route.ts` is liveness-only and does not probe dependencies.

**Impact**

- Missing DSN can silently degrade error reporting.
- Full trace sampling is expensive and noisy.
- Health checks can return healthy even when key backends are unavailable.

### RA-010 - Infrastructure and integration defaults are still weak
**Severity:** Medium

**Evidence**

- `src/lib/rate-limit.ts` and `src/lib/rate-limit-acknowledge.ts` each open their own Redis client.
- `src/app/api/dpo/investigator/route.ts` and `src/app/api/dpo/export-forensic/route.ts` default `ELASTICSEARCH_PASSWORD` to `"changeme"`.

**Impact**

- Redis connection management is less efficient than necessary.
- Elasticsearch fallback credentials are not safe defaults for a sensitive DPO surface.

### RA-011 - `sla/config-updated` is still a dead event
**Severity:** Low

**Evidence**

- `src/actions/sla.ts` sends `sla/config-updated`.
- `src/inngest/client.ts` defines it.
- `src/inngest/functions.ts` has no consumer for it.

**Impact**

- Event noise and misleading architecture assumptions.
- Not immediately exploitable, but it is correctness debt.

## Original Findings That Still Stand

The following original-report findings remain valid in the current repo:

- Secret-bearing files exist at repo root: `.env` and `API KEYS`.
- `clinicalSlaMinutes: 10` is hardcoded in complaint submission.
- Patient intake accepts universal OTP `0000`.
- Console statements remain in multiple app files.
- The login-risk fingerprint hash is weak.
- Server and edge Sentry configs use `tracesSampleRate: 1`.
- Complaint and acknowledge rate limiters use separate Redis clients.
- `/api/health` is only a liveness endpoint.
- `sla/config-updated` has no handler.

## Priority Order

### P0

- Repair anonymous intake so code, schema, and seed data agree.
- Make staff OTP mode fail closed unless live mode is intentionally enabled.
- Align `audit_logs` and `security_alerts` writers with the actual database schemas.

### P1

- Fix all `/staff/...` redirects to the real App Router paths.
- Normalize role comparisons across guards, layouts, and API routes.
- Mark `/api/acknowledge` as public in `src/proxy.ts`.
- Decide which admin/reporting surfaces truly require AAL2 and enforce that consistently.
- Add rate limiting to both OTP request and OTP verify.

### P2

- Replace placeholder Sentry defaults and tune trace sampling.
- Consolidate Redis client creation.
- Remove default Elasticsearch password fallbacks.
- Add a readiness-style dependency probe if the endpoint is meant for operations.

## Final Assessment

The original report is **useful as a partial audit artifact**, but it is **not the right report to rely on for the current repo state**. The current workspace has more serious correctness and security-alignment issues than the original scorecard reflects, especially in anonymous intake, auth mode switching, route access, and audit-schema compatibility.
