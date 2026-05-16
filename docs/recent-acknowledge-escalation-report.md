# Recent Acknowledge and Escalation Changes Report

## Summary

This change set was a security and reliability pass across the acknowledge flow,
the escalation worker, and the staff dashboard UI.

The main goals were:

- Make secure-link acknowledgement retry-safe and idempotent.
- Move escalation state changes into DB-backed helpers so partial writes do not
  silently succeed.
- Complete the in-app notification path on the staff dashboard.
- Attribute acknowledgement actions to the notified staff recipient in audit and
  status-history records.

## What Changed

### 1. Retry-safe acknowledge flow

The migration `042_retry_safe_acknowledge_and_escalation_helpers.sql` adds:

- `public.get_effective_actor_user_id()`
- `public.acknowledge_notification_link(...)`
- `public.escalate_primary_acknowledgement_breach(...)`
- `public.escalate_secondary_acknowledgement_breach(...)`

The acknowledge helper now:

- validates the notification by `complaint_id` plus `secure_link_id`
- rejects unknown, expired, and missing complaint cases
- updates the complaint and notification together
- records the completion event only after the mutation succeeds
- returns structured outcomes such as:
  - `acknowledged`
  - `already_acknowledged`
  - `already_read`
  - `expired`
  - `unknown`
  - `complaint_missing`

The audit and status-history triggers now prefer an app-supplied actor via
`app.current_actor_user_id`, then fall back to the authenticated app user.

### 2. API acknowledge route

`src/app/api/acknowledge/route.ts` now:

- keeps IP rate limiting
- keeps signed-token verification
- calls the DB helper `acknowledge_notification_link(...)`
- returns `200` for safe replays instead of burning the link early
- only emits the follow-up Inngest events that are still needed

The same file also now includes a dev-only seeded fixture path through
`GET /api/acknowledge?seed=1...` so local testing can create:

- a real complaint row
- a matching pending notification
- a valid signed token

### 3. Atomic primary and secondary escalation

`src/inngest/functions.ts` now delegates escalation writes to DB helpers instead
of manually performing multi-step mutations in TypeScript.

Primary escalation now:

- waits for the SLA window
- confirms the complaint is still `submitted`
- creates a secure link and deep link
- calls `escalate_primary_acknowledgement_breach(...)`
- logs and stops cleanly if there is no recipient

Secondary escalation now:

- waits 15 minutes after primary escalation
- confirms the complaint is still `escalated`
- creates a new secure link and deep link
- calls `escalate_secondary_acknowledgement_breach(...)`
- expires older pending notifications before inserting the next escalation

### 4. Staff dashboard and escalation landing route

The missing staff dashboard path is now implemented with:

- `src/app/(staff)/dashboard/page.tsx`
- `src/app/(staff)/dashboard/DashboardClient.tsx`
- `src/app/(staff)/dashboard/escalations/page.tsx`

The dashboard now:

- loads complaint metadata on the server
- loads pending in-app notifications for the current staff user
- shows a pending escalations panel
- shows an acknowledgement result banner after redirect
- keeps the complaint queue PHI-free until the user explicitly opens details

The escalation landing page now:

- reads `context`, `token`, and `escalated`
- posts the token to `/api/acknowledge`
- redirects back to `/dashboard?context=<complaintId>&ack=<outcome>`
- shows a compact retry/error state instead of failing into a dead path

### 5. Notification realtime typing and subscription updates

`src/lib/realtime-subscriptions.ts` now reflects the actual notification schema.

The notification payload now includes fields like:

- `recipient_id`
- `complaint_id`
- `deep_link`
- `status`
- `created_at`
- `delivered_at`
- `read_at`

The notification subscription now listens to both:

- `INSERT`
- `UPDATE`

### 6. Test scripts updated

The following scripts were updated to match the new behavior:

- `tests/test-acknowledge-api.ps1`
- `tests/t1-t2-db-integration.ps1`
- `tests/t1-t2-rerun.ps1`
- `tests/security/pen_test_suite.ps1`

They now:

- use seeded real fixtures where appropriate
- expect replay to return safe idempotent `200`
- use a signed expired token path instead of fake unsigned payloads

## End-to-End Walkthrough

### Complaint to primary escalation

1. A complaint is created and the app emits `complaint/submitted`.
2. The primary SLA worker sleeps for the configured window.
3. When it wakes up, it checks whether the complaint is still `submitted`.
4. If yes, it builds a secure acknowledgement token and deep link.
5. It calls `escalate_primary_acknowledgement_breach(...)`.
6. The DB helper:
   - locks the complaint
   - verifies it is still eligible
   - inserts an SLA breach record
   - resolves the active primary on-call recipient
   - creates a pending notification
   - moves the complaint to `escalated`

### Dashboard notification path

1. The server dashboard page loads complaint metadata and pending notifications.
2. The client dashboard subscribes to realtime notification and breach events.
3. A pending escalation appears in the "Pending escalations" panel.
4. The user clicks `Open escalation`.

### Secure acknowledgement path

1. The user lands on `/dashboard/escalations?...`.
2. That page posts the token to `/api/acknowledge`.
3. The API route:
   - rate-limits by IP
   - verifies the signed token
   - calls `acknowledge_notification_link(...)`
4. The DB helper:
   - locks the notification row
   - locks the complaint row
   - sets `app.current_actor_user_id` to `notifications.recipient_id`
   - if the complaint is still `submitted` or `escalated`, marks it `acknowledged`
   - marks the notification `read`
   - records the completion event in `processed_events`
5. The route sends follow-up events:
   - `complaint/notification_read`
   - `complaint/resolved` when the primary timer must be cancelled
6. The landing page redirects back to:
   - `/dashboard?context=<complaintId>&ack=<outcome>`
7. The dashboard shows a success or already-handled banner.

### Retry behavior

If the same secure link is retried:

- the route still verifies the token
- the DB helper returns a safe current-state outcome
- the API responds with `200`
- the link is no longer lost because of mid-flight failure ordering

### Secondary escalation path

1. If a complaint remains `escalated` for another 15 minutes,
   `escalationWakeUp` runs.
2. It calls `escalate_secondary_acknowledgement_breach(...)`.
3. The helper:
   - confirms the complaint is still `escalated`
   - inserts another breach record
   - expires older pending notifications for that complaint
   - inserts the next escalation notification

## Files Touched

### Database

- `database/migrations/042_retry_safe_acknowledge_and_escalation_helpers.sql`
- `database/supabase-cli/supabase/migrations/042_retry_safe_acknowledge_and_escalation_helpers.sql`

### Backend

- `src/app/api/acknowledge/route.ts`
- `src/inngest/functions.ts`
- `src/lib/realtime-subscriptions.ts`

### Staff UI

- `src/app/(staff)/dashboard/page.tsx`
- `src/app/(staff)/dashboard/DashboardClient.tsx`
- `src/app/(staff)/dashboard/escalations/page.tsx`

### Test Scripts

- `tests/test-acknowledge-api.ps1`
- `tests/t1-t2-db-integration.ps1`
- `tests/t1-t2-rerun.ps1`
- `tests/security/pen_test_suite.ps1`

## Manual Testing Procedure

### Preconditions

Make sure these are running as needed:

- Next.js dev server
- Redis or the configured rate-limit backing service
- Supabase local or linked project access
- Inngest path if you want full escalation timing coverage

### Test 1: Happy-path acknowledgement

1. Create a seeded fixture:

```powershell
$cid = [guid]::NewGuid().ToString()
Invoke-WebRequest "http://localhost:3000/api/acknowledge?seed=1&complaintId=$cid" -Method GET
```

2. Copy the returned `token`.

3. POST it to the acknowledge route:

```powershell
Invoke-WebRequest "http://localhost:3000/api/acknowledge" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{ token = "<TOKEN>" } | ConvertTo-Json)
```

Expected result:

- HTTP `200`
- JSON includes `outcome = "acknowledged"`

### Test 2: Replay is safe

Repeat the same POST with the same token.

Expected result:

- HTTP `200`
- JSON includes:
  - `already_read`, or
  - `already_acknowledged`

### Test 3: Expired token handling

1. Create an already-expired signed fixture:

```powershell
$cid = [guid]::NewGuid().ToString()
Invoke-WebRequest "http://localhost:3000/api/acknowledge?seed=1&complaintId=$cid&expiresInSeconds=-3600" -Method GET
```

2. POST that returned token to `/api/acknowledge`.

Expected result:

- HTTP `401`
- error mentions invalid or expired token

### Test 4: Rate limiting

Run:

```powershell
.\tests\test-acknowledge-api.ps1
```

Expected result:

- first 5 requests succeed
- 6th request returns `429`

### Test 5: Dashboard pending notification rendering

1. Log in as the staff user who is the `recipient_id` of a pending notification.
2. Open `/dashboard`.

Expected result:

- pending escalation cards appear in the new panel
- complaint queue still renders below
- no PHI appears in the escalation cards

### Test 6: Escalation landing route

1. Click `Open escalation` from a dashboard notification card.

Expected result:

- `/dashboard/escalations?...` loads
- it automatically POSTs to `/api/acknowledge`
- it redirects back to `/dashboard?context=<id>&ack=<outcome>`
- the dashboard shows the correct acknowledgement banner

### Test 7: Database state after acknowledgement

Run checks like:

```sql
select id, status, updated_at
from public.complaints
where id = '<complaint-id>';

select id, status, recipient_id, read_at
from public.notifications
where complaint_id = '<complaint-id>'
order by created_at desc;

select event_name, event_id, payload
from public.processed_events
where event_id like 'acknowledge-click:%'
order by created_at desc;
```

Expected result:

- complaint status is `acknowledged`
- targeted notification is `read`
- a processed completion event exists for the secure link

### Test 8: Audit attribution

Run checks like:

```sql
select complaint_id, previous_status, new_status, changed_by
from public.complaint_status_history
where complaint_id = '<complaint-id>'
order by id desc;

select table_name, record_id, action_type, performed_by
from public.audit_logs
where record_id = '<complaint-id>'
order by created_at desc;
```

Expected result:

- `changed_by` matches the notified staff recipient
- `performed_by` matches the notified staff recipient

### Test 9: Primary and secondary escalation

For full worker behavior:

1. Submit a fresh complaint.
2. Let the primary SLA window pass.
3. Confirm:
   - one SLA breach log entry exists
   - one pending notification exists
   - the complaint moved to `escalated`
4. Leave it unacknowledged for the secondary wait.
5. Confirm:
   - older pending notifications are marked `expired`
   - the next escalation notification is inserted

## Automated Verification Already Performed

The following checks were already run during implementation:

- `pnpm exec tsc --noEmit`
- targeted `eslint` on the changed files
- `pnpm supabase:sync-workdir`
- `pnpm supabase:db:push:dry-run`
- `pnpm supabase:db:push`
- post-push dry run confirming the remote database is up to date

## Residual Note

This change completes the current in-app escalation acknowledgement flow.

It does not add a login-redirect preservation flow for future email or SMS
deep links that begin outside an authenticated dashboard session. That would be
a separate follow-up if cross-channel secure-link entry becomes a product need.
