# Task 4.2 Walkthrough: Supabase Realtime Subscriptions & WebSocket RLS

## What Was Built

### A. SQL — Realtime Enabled on Docker Supabase

Ran directly via `docker exec` against `supabase-db` (healthy):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE sla_breach_log;
```

Output: `ALTER PUBLICATION` × 3 ✅

---

### B. New File: [src/lib/realtime-subscriptions.ts](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts)

Three typed subscription factories:

| Factory | Table | Scope |
|---------|-------|-------|
| [subscribeToComplaints(supabase, cb, departmentId?)](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts#54-76) | `complaints` | Ward Nurses: filtered by `department_id`; Coordinators: pass `undefined` → hospital-wide via RLS |
| [subscribeToNotifications(supabase, userId, cb)](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts#81-103) | `notifications` | Filtered by `recipient_id=eq.{userId}` |
| [subscribeToBreaches(supabase, cb)](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts#111-131) | `sla_breach_log` | No client filter — RLS on `sla_breach_log` enforces hospital-level scoping |

PHI-safe: complaint channel exposes only metadata columns, never PHI fields.

---

### C. Modified: [src/store/useSlaStore.ts](file:///c:/Application%20V4.0/src/store/useSlaStore.ts)

Added to the Zustand store:

| Addition | Purpose |
|----------|---------|
| `complaints: PublicComplaint[]` | Holds the ordered complaint list for the DataTable |
| [setComplaints(data)](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#56-57) | Seeds initial data (Sprint 5: replaced by real fetch) |
| [hoist(complaintId)](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#40-55) | Moves complaint to index 0, increments `activeBreaches`, adds to `criticalHoists[]` |

[hoistComplaint()](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#38-39) retained for backward compatibility.

---

### D. Modified: [src/app/(staff)/dashboard/page.tsx](file:///c:/Application%20V4.0/src/app/%28staff%29/dashboard/page.tsx)

Two `useEffect` hooks added:

1. **Seed effect** (`[]` deps): Calls [setComplaints(mockComplaints)](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#56-57) on mount
2. **Realtime effect** (`[]` deps):
   - Initializes [createEncryptedBrowserClient()](file:///c:/Application%20V4.0/src/lib/supabase-client.ts#4-23)
   - Calls [subscribeToBreaches()](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts#111-131) → wires [hoist(payload.new.complaint_id)](file:///c:/Application%20V4.0/src/store/useSlaStore.ts#40-55) as callback
   - `.subscribe()` with status logging
   - Returns cleanup: `supabase.removeChannel(channel)` — prevents memory leaks
   - Graceful try/catch for test/build environments without Supabase env vars

DataTable's [data](file:///c:/Application%20V4.0/src/lib/realtime-subscriptions.ts#27-36) prop now reads from `useSlaStore` instead of static const.

---

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | ✅ Exit 0 — zero TypeScript errors |
| `pnpm build` | ✅ Exit 0 — all 15 pages compiled |
| Realtime containers | ✅ `realtime-dev.supabase-realtime` running, `supabase-db` healthy |

---

## Manual Test: Simulate Breach Hoist (No Live Supabase Insert Needed)

1. Start dev server: `pnpm dev`
2. Open `http://localhost:3000/dashboard`
3. Observe initial DataTable order (CMP-001 → CMP-005)
4. Open Chrome DevTools → Application → expand the Zustand store state OR open Console and run:

```js
// Simulate a Realtime breach event for CMP-003 (Pharmacy, medium severity)
// This is what the WebSocket callback would call
(await import('./src/store/useSlaStore')).useSlaStore.getState().hoist('CMP-003')
```

**Expected**: CMP-003 (Pharmacy) moves to **row 0** of the DataTable without any page refresh. `activeBreaches` counter increments.

> **Full live test** (requires Supabase connected): In Supabase Table Editor → `sla_breach_log` → Insert row with `complaint_id = 'CMP-001'` → observe dashboard hoisting in real-time via WebSocket.
