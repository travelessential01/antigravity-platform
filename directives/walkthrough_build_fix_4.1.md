# Sprint 4.1 Build Fix — Walkthrough

## Result: ✅ Build Succeeded (Exit Code 0)

```
✓ Compiled successfully in 54s
✓ Finished TypeScript in 33.1s
✓ Collecting page data using 3 workers in 6.6s
✓ Generating static pages using 3 workers (15/15) in 8.4s
✓ Collecting build traces in 75s
✓ Finalizing page optimization in 75s
```

---

## Route Table (Final)

| Route | Mode |
|---|---|
| `/` | ○ Static |
| `/_not-found` | ○ Static |
| `/api/escalation/resolve` | ƒ Dynamic |
| `/api/inngest` | ƒ Dynamic |
| `/auth/callback` | ƒ Dynamic |
| `/auth/mfa/challenge` | ○ Static |
| `/auth/mfa/enroll` | ○ Static |
| `/dashboard` | ○ Static |
| `/intake` | ○ Static |
| `/investigator` | ○ Static |
| `/login` | ○ Static |
| `/mock-qr` | ○ Static |
| `/settings` | ○ Static |
| `/settings/sla-config` | ○ Static |

---

## Six Root-Cause Bugs Fixed

### 1. Duplicate `/dashboard` Route Conflict
- **Error**: `You cannot have two parallel pages that resolve to the same path`
- **Fix**: Deleted [src/app/dashboard/page.tsx](file:///c:/Application%20V4.0/src/app/dashboard/page.tsx) (created in error). Merged full Zero-PHI DataTable content into the canonical [src/app/(staff)/dashboard/page.tsx](file:///c:/Application%20V4.0/src/app/%28staff%29/dashboard/page.tsx).

### 2. [middleware.ts](file:///c:/Application%20V4.0/src/middleware.ts) — `session.aal` Type Error
- **Error**: `Property 'aal' does not exist on type 'User'` / then `on type 'Session'`
- **Fix**: Replaced `session.user?.aal` with the correct Supabase v2 API: `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` returning `{ currentLevel, nextLevel }`.

### 3. [workflow.ts](file:///c:/Application%20V4.0/src/actions/workflow.ts) — `use server` Non-Async Export Violation
- **Error**: `A "use server" file can only export async functions, found object.`
- **Fix**: Extracted `WORKFLOW_STATES` const and [ComplaintStatus](file:///c:/Application%20V4.0/src/actions/workflow.types.ts#13-14) type to a new [workflow.types.ts](file:///c:/Application%20V4.0/src/actions/workflow.types.ts) file. Updated [workflow.ts](file:///c:/Application%20V4.0/src/actions/workflow.ts) to import from it. Next.js 16 strictly disallows exporting non-function values from `use server` files.

### 4. [encrypted-storage.ts](file:///c:/Application%20V4.0/src/lib/encrypted-storage.ts) — [getDb()](file:///c:/Application%20V4.0/src/lib/encrypted-storage.ts#5-20) IndexedDB SSR Guard
- **Error**: `ReferenceError: indexedDB is not defined` during static generation of [(patient)/intake/page](file:///c:/Application%20V4.0/src/actions/complaints.ts#28-29)
- **Fix**: Added `typeof window === 'undefined'` guard at the top of [getDb()](file:///c:/Application%20V4.0/src/lib/encrypted-storage.ts#5-20). The outer methods already had this check, but the shared underlying function did not.

### 5. [(patient)/intake/page.tsx](file:///c:/Application%20V4.0/src/actions/complaints.ts#28-29) — Client-Only Dynamic Import
- **Error**: `TypeError: d.useSyncExternalStore is not a function` (Zustand running during SSR)
- **Attempted**: `force-dynamic` alone (insufficient), `next/dynamic({ ssr: false })` in Server Component (blocked by Next.js 16 rule)
- **Final Fix**: Added `'use client'` to [page.tsx](file:///c:/Application%20V4.0/src/app/page.tsx) and wrapped the form import with `next/dynamic({ ssr: false })`. Moved the full form logic to [IntakeForm.tsx](file:///c:/Application%20V4.0/src/app/%28patient%29/intake/IntakeForm.tsx).

### 6. [auth/mfa/challenge/page.tsx](file:///c:/Application%20V4.0/src/app/auth/mfa/challenge/page.tsx) — `useSearchParams` Suspense Boundary
- **Error**: Prerender crash on `/auth/mfa/challenge`
- **Fix**: Extracted the component body to [MFAChallengeContent](file:///c:/Application%20V4.0/src/app/auth/mfa/challenge/page.tsx#14-147), then wrapped it in `<Suspense>` in the default export. Next.js 16 requires all components using `useSearchParams()` to be inside a Suspense boundary.

---

## New Files Created

| File | Purpose |
|---|---|
| [src/actions/workflow.types.ts](file:///c:/Application%20V4.0/src/actions/workflow.types.ts) | Shared constants extracted from `use server` file |
| [src/app/(patient)/intake/IntakeForm.tsx](file:///c:/Application%20V4.0/src/app/%28patient%29/intake/IntakeForm.tsx) | Client component form logic (split from page.tsx) |
| [src/store/useSlaStore.ts](file:///c:/Application%20V4.0/src/store/useSlaStore.ts) | Extended with `ackHours`, `resHours`, [setBounds](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#21-22) |
| [src/app/settings/sla-config/SlaConfigClient.tsx](file:///c:/Application%20V4.0/src/app/settings/sla-config/SlaConfigClient.tsx) | Admin SLA configuration sliders |
| [src/app/settings/sla-config/page.tsx](file:///c:/Application%20V4.0/src/app/settings/sla-config/page.tsx) | SLA settings route |
| [src/components/dashboard/columns.tsx](file:///c:/Application%20V4.0/src/components/dashboard/columns.tsx) | Zero-PHI DataTable column definitions + Resolve action |
| [src/components/dashboard/data-table.tsx](file:///c:/Application%20V4.0/src/components/dashboard/data-table.tsx) | TanStack React Table wrapper |
