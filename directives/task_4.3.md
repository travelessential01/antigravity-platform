# Task 4.3 — Multi-Channel Notification Engine

**Sprint:** 4 | **Owner:** Backend Engineer | **Risk:** MEDIUM
**Directive Reference:** [`antigravity_v4.1.md`](file:///c:/Application%20V4.0/directives/antigravity_v4.1.md) §Sprint 4, Task 4.3
**Status:** 🔴 Not Started
**Dependency:** Task 4.2 (Realtime Subscriptions) must be complete — `sla_breach_log` INSERT webhook is the primary trigger source.

---

## Objective

Build a fully compliant, multi-channel notification engine that dispatches **zero-PHI** alerts via email, SMS (TRAI/DLT compliant), and in-app channels, with a 1-click deep-link acknowledgment system that atomically cancels SLA timers and is replay-attack-proof.

---

## Deliverable

> **E2E Demo:** SLA breach → shift-aware SMS with DLT Template ID → 1-click deep-link → complaint status = `acknowledged` → Inngest SLA timer cancels → `notifications.status = 'Read'`

---

## Sub-Tasks

### A — Deno Edge Functions (3 functions)

| # | Function | Trigger | Status |
|---|----------|---------|--------|
| A1 | `onComplaintCreated` | DB Webhook on `complaints` INSERT | ☐ |
| A2 | `onSlaBreach` | DB Webhook on `sla_breach_log` INSERT | ☐ |
| A3 | `nightlyComplianceAudit` | `pg_cron` at `0 21 * * *` UTC (02:30 IST) | ☐ |

#### A1 — `supabase/functions/on-complaint-created/index.ts`
- [ ] Extract `complaint_id`, `department_id`, `hospital_id` from webhook payload
- [ ] Idempotency check: query `processed_events` → skip if already processed
- [ ] Query `on_call_schedules` → find shift-active manager for `department_id`
- [ ] Fallback: if no active shift → route to Quality Coordinator
- [ ] Generate `secure_link_id` (UUID v4) → INSERT into `notifications`
- [ ] Dispatch in-app notification (**ZERO PHI**: only `secure_link_id` + department + severity)
- [ ] INSERT into `processed_events` after successful dispatch

#### A2 — `supabase/functions/on-sla-breach/index.ts`
- [ ] Idempotency check via `processed_events`
- [ ] Query breach record → get `complaint_id`, `escalation_level`
- [ ] Query `on_call_schedules` → identify on-call manager
- [ ] Generate JWT-signed deep-link token: `{ complaintId, token: UUID, exp: now + 15min }`
- [ ] **SMS — MSG91 primary:**
  ```
  POST https://api.msg91.com/api/v5/flow/
  Headers: { authkey: MSG91_API_KEY }
  Body: { flow_id: DLT_TEMPLATE_ID, mobiles: manager_phone, complaintRef: ticket_id }
  ```
- [ ] **SMS — Twilio fallback** (if MSG91 returns non-200):
  ```
  POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages
  Body: { To: phone, From: TWILIO_PHONE_NUMBER, Body: DLT_TEMPLATE_TEXT }
  ```
- [ ] INSERT `notifications` → INSERT `processed_events`

#### A3 — `supabase/functions/nightly-compliance-audit/index.ts`
- [ ] Check `status = 'submitted'` AND `created_at < NOW() - INTERVAL '24 hours'` (unacknowledged breach)
- [ ] Check `is_escalated = true` AND `escalated_to IS NULL` (NULL escalation gap)
- [ ] Check complaints stuck in `investigating` for > 7 days
- [ ] Check `capa_validated` complaints without audit_logs CAPA signature entry
- [ ] Aggregate findings → INSERT one `security_alerts` row as compliance digest

---

### B — Zero-PHI Enforcement (Absolute Rule)

- [ ] Validate: raw SMS payload contains NO `description`, `reporter_name`, or `reporter_contact`
- [ ] Validate: raw email payload contains NO patient data
- [ ] Validate: in-app notification payload contains NO PHI fields

**Zero-PHI Validation Matrix:**

| Channel | Fields Transmitted | PHI Present? |
|---------|-------------------|--------------|
| SMS | `secure_link_id`, department name, severity | ❌ NO |
| Email | `secure_link_id`, ticket reference, department | ❌ NO |
| In-App | `secure_link_id`, severity badge, SLA countdown | ❌ NO |
| Deep-Link URL | `complaintId` (UUID), `token` (UUID) | ❌ NO |

---

### C — 1-Click Deep-Link Acknowledgment API

**File:** `src/app/api/acknowledge/route.ts`

- [ ] POST handler with the following atomic sequence:
  1. **Rate limit:** 5 req/min per IP via Redis Token Bucket (key: `ratelimit:acknowledge:${ip}`) → `429` on breach
  2. **Verify** JWT-signed token → extract `complaintId`, validate `exp`
  3. **Idempotency:** check `processed_events` for `event_id = token` → return `403 — token already consumed` if exists
  4. **Transition** complaint to `acknowledged` via `transitionComplaintStatus()`
  5. **Cancel SLA timer:** `inngest.send({ name: 'complaint/resolved', data: { complaintId } })`
  6. **Mark notification read:** `UPDATE notifications SET status = 'Read' WHERE complaint_id = complaintId`
  7. **Record:** INSERT `processed_events` with `event_id = token, event_name = 'acknowledge_click'`

**File:** `src/lib/rate-limit-acknowledge.ts`
- [ ] Redis Token Bucket: `limit = 5`, `window = 60s`, key prefix `ratelimit:acknowledge:`
- [ ] Distinct from existing `src/lib/rate-limit.ts` — separate key namespace

---

### D — TRAI/DLT SMS Compliance

- [ ] MSG91 configured as primary SMS gateway
- [ ] Twilio configured as fallback
- [ ] Pre-approved DLT Template IDs embedded in **every** SMS payload (not optional)
- [ ] Add to `.env`:
  ```
  MSG91_API_KEY=
  MSG91_SENDER_ID=
  MSG91_DLT_TEMPLATE_ID=
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_PHONE_NUMBER=
  ```

---

### E — Shift-Aware Routing & Idempotency

- [ ] Every dispatch function queries `on_call_schedules` BEFORE sending notification
- [ ] If no active shift found → default to Quality Coordinator for `hospital_id`
- [ ] `processed_events` checked BEFORE any side-effect on every Edge Function entry
- [ ] INSERT `processed_events` ONLY AFTER successful dispatch (not before)

---

## File Map

| File | Action | Notes |
|------|--------|-------|
| `supabase/functions/on-complaint-created/index.ts` | 🆕 NEW | Deno runtime |
| `supabase/functions/on-sla-breach/index.ts` | 🆕 NEW | Deno runtime, MSG91 + Twilio |
| `supabase/functions/nightly-compliance-audit/index.ts` | 🆕 NEW | pg_cron scheduled |
| `src/app/api/acknowledge/route.ts` | 🆕 NEW | Next.js POST handler |
| `src/lib/rate-limit-acknowledge.ts` | 🆕 NEW | Redis Token Bucket |
| `.env` | ✏️ MODIFY | Add MSG91 + Twilio vars |

---

## Verification Checklist

### Automated Tests
- [ ] Fire `on-sla-breach` webhook → verify MSG91 API call payload contains `DLT_TEMPLATE_ID`
- [ ] Simulate MSG91 failure (non-200) → verify Twilio fallback executes
- [ ] POST to `/api/acknowledge` with valid token → verify complaint status = `acknowledged`
- [ ] POST same token again → verify `403 — token already consumed`
- [ ] POST 6 times in 60s → verify 6th request returns `429`
- [ ] Trigger `nightly-compliance-audit` → verify `security_alerts` row inserted with digest

### Manual
- [ ] Trigger real SLA breach → receive SMS on test phone → click deep-link in SMS
- [ ] Verify SLA timer cancelled in Inngest dashboard
- [ ] Verify `notifications.status = 'Read'` in Supabase dashboard

---

## Compliance Notes

> [!IMPORTANT]
> The TRAI/DLT Template ID is a **legal requirement** under India's TRAI regulations. Every SMS must embed a pre-registered DLT Template ID in the `flow_id` field. Sending without it will result in carrier rejection.

> [!WARNING]
> The 15-minute deep-link TTL is non-negotiable per Task 3.4 (Escalation Engine). The 15-minute Wake-Up protocol depends on this window. Do not extend without directive update.

> [!NOTE]
> `processed_events` idempotency is the primary defence against duplicate notifications on Edge Function retry. Always check BEFORE dispatch, INSERT AFTER success.
