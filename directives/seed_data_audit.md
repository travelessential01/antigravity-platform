# StayAssist V1 — Seed Data Audit Report
> **Generated:** 2026-04-09 | **Scope:** `database/migrations/` directory
> **Sprint context:** Post Sprint-B. Seed scripts must be quarantined before production deployment.

---

## Overview

There are **4 active seed scripts** present in the migrations folder alongside the structural schema migrations. All 4 contain data that must not be applied to a production or UAT environment. They are currently co-located with schema migrations (`001` through `031`), creating a risk of accidental application.

| Script | Size | Purpose | Risk |
|---|---|---|---|
| `seed.sql` | 19 KB, 152 lines | Base Apollo Hospital mock data — 145 staff, 13 departments | 🔴 CRITICAL |
| `rtiics_demo_seed.sql` | 18 KB, 294 lines | Client demo data for RTIICS (cardiac hospital) | 🔴 CRITICAL |
| `sprint_6_seed_data.sql` | 12.7 KB, 237 lines | Chaos/load test data — 200+ random complaints, 50 SLA breaches | 🟠 HIGH |
| `024_faqs_seed.sql` | 35 KB, 691 lines | Default admin knowledge base FAQ content | 🟡 MEDIUM |

---

## Script 1: `seed.sql`

**Source:** `F:\Application V4.0\.tmp\mock_staff_directory.csv` (noted in file header)
**Applied to:** Apollo Hospitals Enterprise

### Injected Entities

| Table | Rows | Details |
|---|---|---|
| `organizations` | 1 | `Apollo Hospitals Enterprise` — UUID `3b965436-...` |
| `hospitals` | 1 | `Apollo Multispeciality Hospital` — UUID `2cf24f6f-...` |
| `departments` | 13 | Quality, Operations, Procurement, Medicine, Surgery, Nursing, Housekeeping, Administration, Medical Superintendent Office, Data Protection Office, Emergency, Radiology, Pharmacy |
| `users` | ~55 | Roles: `quality_coordinator` (10), `admin` (5), `medical_superintendent` (1), `dpo` (1), `department_manager` (38 across 8 depts) |
| `sla_configurations` | 4 | Critical: 1h ack / 24h res, High: 4h/72h, Medium: 8h/168h, Low: 24h/720h |

### Risk Assessment
- All user emails use `@apollohospital.local` — clearly mock, but these users will appear in auth lists and role lookups if the seed was applied against `auth.users` via SSO sync
- The Apollo Hospital UUID (`2cf24f6f-...`) is **directly referenced** in `sprint_6_seed_data.sql` — removing `seed.sql` data without also removing Sprint 6 data will leave orphaned foreign keys
- `sla_configurations` inserted without checking if real config exists — will **duplicate** if real hospital is already seeded with the same `hospital_id`

### Action: 🔴 QUARANTINE

---

## Script 2: `rtiics_demo_seed.sql`

**Purpose:** Client demonstration for Rabindranath Tagore Institute for Cardiac Sciences (a real hospital name)

### Injected Entities

| Table | Rows | Details |
|---|---|---|
| `organizations` | 1 | `Tagore Medical Trust` — UUID `352d29ef-...` |
| `hospitals` | 1 | `Rabindranath Tagore Institute for Cardiac Sciences`, Kolkata — NABH + JCI = TRUE |
| `departments` | 10 | Cardiology, Cardiac Surgery, Cardiac Critical Care (ICCU), Cardiac Rehabilitation, Nursing Services, Quality & Patient Safety, Administration, Medical Superintendent Office, DPO, Emergency & Trauma |
| `users` | 13 | Admin, Medical Superintendent, 2× Quality Coordinator, DPO, 4× Department Manager, 5× Demo Patients |
| `sla_configurations` | 4 | NABH/JCI compliant thresholds |
| `complaints` | 5 | 1 golden (closed/full lifecycle), 1 critical SLA-breached, 1 high investigating, 1 medium acknowledged, 1 low resolved |
| `complaint_phi` | 5 | Obfuscated using `md5(...)` — **not real PHI** but structurally present |
| `complaint_status_history` | 6 | Full lifecycle for golden complaint |
| `patient_consents` | 5 | All using consent version `v2.1-DPDP-2023`, fake IPs `10.10.1.x` |
| `sla_breach_log` | 1 | Critical ICCU complaint |
| `notifications` | 5 | Mix of `in_app` and `email` |
| `audit_logs` | 1 | `CAPA_SIGN_OFF` event for golden complaint |

### Risk Assessment
- Uses the **real name of a real hospital** (`Rabindranath Tagore Institute for Cardiac Sciences`) — if left in production DB, could create legal and regulatory exposure under DPDP Act
- Demo patient accounts include `email` fields (`patient.demo1@rtiics.local`) which, if synced to an SSO provider, could create phantom accounts
- PHI rows use `md5()` not AES-256-GCM — this violates the encryption contract established in Sprint B.2. These rows will have `key_version = 1` (backfilled by migration) but the `description` bytes are garbage to the decryption function
- The SLA-breach complaint (`c9ebd0e9-...`) was created with `sla_deadline = NOW() - INTERVAL '1 hour'` — a time-relative value that becomes incorrect once data ages

### Action: 🔴 QUARANTINE immediately

---

## Script 3: `sprint_6_seed_data.sql`

**Purpose:** Chaos, security, and disaster recovery testing. 200+ random complaints, 50+ SLA breach records.

### Injected Entities

| Table | Rows | Details |
|---|---|---|
| `hospitals` | 1 | `Apollo Indraprastha Hospital` — cross-tenant test entity |
| `departments` | 1 | Cardiology for cross-tenant hospital |
| `users` | 6 | 1 cross-tenant manager + 5 named test patients (`patient.a001@example.com` through `patient.e005@example.com`) |
| `complaints` | ~201 | 1 golden (90 days old) + 200 generated via PL/pgSQL loop using `gen_random_uuid()` and `random()` |
| `complaint_phi` | ~201 | PHI rows using `md5(random()::text)` — same encryption contract violation as RTIICS |
| `complaint_status_history` | 6 | Full lifecycle for golden complaint |
| `patient_consents` | ~201 | Fake IPs `10.0.x.x`, consent version `v2.1-DPDP-2023` |
| `sla_breach_log` | ~50 | Generated via PL/pgSQL querying existing complaint IDs |
| `notifications` | ~30 | All routed to a single seed user UUID |
| `audit_logs` | 1 | `CAPA_SIGN_OFF` for golden complaint |

### Risk Assessment
- This is the **largest volume injector** — 200 complaints in `complaints` and `complaint_phi` with associated consent and breach records will pollute the dashboard meaningfully
- Uses `random()` for PHI bytes — decrypt will fail for every row (as expected — not real PHI)
- The `sla_breach_log` entries reference complaint IDs resolved from the live DB at seed-time — idempotency is unpredictable across environments
- Cross-tenant `Apollo Indraprastha Hospital` row will appear in RLS-bypassing admin queries and could confuse hospital management screens
- `audit_logs` insert has no `ON CONFLICT` clause — **will throw a duplicate key error** if run twice

### Action: 🟠 QUARANTINE — Retain in `database/quarantine_seeds/` for local chaos testing only

---

## Script 4: `024_faqs_seed.sql`

**Purpose:** Populate the FAQ knowledge base with default content for staff guidance.

### Injected Entities

| Table | Rows | Details |
|---|---|---|
| `faqs` | 27 | Categories: Initial Setup (5), Admin Panel Operations (5), Employee & Department Management (5), Walkthroughs (4), Debugging (5), Troubleshooting (6), General (2) |

### Content Risk Assessment

| FAQ | Compliance Risk |
|---|---|
| "What is the default admin login after fresh setup?" | 🔴 Mentions `admin@hospital.local` default credentials. Must be updated or removed for production |
| "How do I check if Inngest is running?" | 🟡 References `http://localhost:8288` — local dev URL, irrelevant in production |
| "The dashboard shows No facilities registered" | 🟡 Documents the hardcoded `orgId = "00000000-..."` bug directly in published FAQ content |
| "How do I run the database migrations?" | 🟡 Instructs users to run `seed.sql` as part of setup — misleading for production admins |
| SSO, Authentik, DPO, and RLS debug FAQs | ✅ Content is accurate and production-safe |

> **Note on duplication:** The FAQ content in `024_faqs_seed.sql` is a superset of the hardcoded FAQ array embedded in `src/app/(admin)/faq-management/page.tsx`. If both are applied, the DB will have 27 rows from the seed AND the page will show them together with the static array items, creating duplicates in the UI.

### Action: 🟡 PARTIAL — Retain but sanitize 3 FAQs before applying to production

---

## Seed-Linked Code Dependencies

These source files reference seed data UUIDs directly and will break if seed data is wiped without corresponding code changes:

| File | Line | Seed UUID Referenced | Dependency |
|---|---|---|---|
| `src/app/(admin)/org-dashboard/page.tsx` | 23 | `00000000-0000-0000-0000-000000000000` | Dummy org ID — not from any seed; independent bug |
| `src/inngest/functions.ts` | 88 | `00000000-0000-0000-0000-000000000000` | Fallback manager — independent bug |
| `src/inngest/functions.ts` | 167 | `00000000-0000-0000-0000-000000000001` | Fallback manager — independent bug |
| `src/app/(staff)/dashboard/page.tsx` | 22-36 | `mockComplaints` array | Not from DB — static array; independent |

---

## PHI Encryption Violation Summary

Seed scripts inject `complaint_phi` rows using **`md5()` hashes** instead of **AES-256-GCM** encryption. These rows are structurally valid but will cause `readComplaintPHI()` to throw a decryption error when accessed, because:

1. Their column `key_version` is `1` (backfilled by Migration 031)
2. The `description` bytes are not a valid `[IV(12) + Ciphertext + AuthTag(16)]` packed buffer

This is **expected** for demo data but **must not appear** in a production environment. Any surviving seed PHI rows are indistinguishable to application code from corrupted real PHI rows.

---

## Quarantine Plan

### Step 1: Move seed scripts out of migrations

```powershell
New-Item -Path "database\quarantine_seeds" -ItemType Directory -Force
Move-Item "database\migrations\seed.sql"              "database\quarantine_seeds\"
Move-Item "database\migrations\rtiics_demo_seed.sql"  "database\quarantine_seeds\"
Move-Item "database\migrations\sprint_6_seed_data.sql" "database\quarantine_seeds\"
# 024_faqs_seed.sql — PARTIAL: sanitize first, then move
```

### Step 2: Wipe the populated database

```sql
-- Cascades through all FK-linked tables automatically
TRUNCATE TABLE public.organizations CASCADE;
-- Wipe auth users separately (Supabase-managed)
DELETE FROM auth.users WHERE email LIKE '%apollohospital.local%'
   OR email LIKE '%rtiics.local%'
   OR email LIKE '%example.com%';
```

### Step 3: Sanitize and apply FAQ seed selectively

Before applying `024_faqs_seed.sql` to production:
- Remove the "What is the default admin login?" FAQ entry (lines 71–80)
- Update the "The dashboard shows No facilities registered" FAQ (lines 561–585) to remove the hardcoded `orgId` code snippet
- Remove the "How do I run the database migrations?" instruction to execute `seed.sql`

### Step 4: Remove the static FAQ array from source code

Delete the hardcoded `defaultFaqs` array from `src/app/(admin)/faq-management/page.tsx` and rely exclusively on the DB-seeded content.

---

## Summary Table

| Script | Type | Tables Affected | Action |
|---|---|---|---|
| `seed.sql` | Primary base seed | 5 tables, 145 users | 🔴 Quarantine immediately |
| `rtiics_demo_seed.sql` | Client demo seed | 11 tables, real hospital name | 🔴 Quarantine immediately |
| `sprint_6_seed_data.sql` | Load/chaos test seed | 9 tables, 200+ complaints | 🟠 Quarantine, keep for local testing |
| `024_faqs_seed.sql` | Knowledge base seed | 1 table, 27 rows | 🟡 Sanitize 3 entries, then apply |
| `faq-management/page.tsx` static array | Hardcoded UI seed (not SQL) | UI only | 🟡 Delete after DB has FAQ content |
