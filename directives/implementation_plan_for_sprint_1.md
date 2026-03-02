# Task 1.1: Schema Design & SQL Migrations

Build the complete 14-table Postgres schema for the Antigravity healthcare grievance platform via 15 sequential SQL migrations, executed against the self-hosted Supabase Docker instance.

## Key Design Decisions

> [!IMPORTANT]
> **PHI columns use `BYTEA`** — encryption/decryption happens exclusively in Next.js Server Actions (AES-256-GCM). The database is entirely blind to plaintext PHI.

> [!IMPORTANT]
> **Roles stored as `TEXT`, not `ENUM`** — avoids migration pain when roles evolve. Validated with a `CHECK` constraint.

> [!IMPORTANT]
> **`pgcrypto` is retained solely for the immutable ledger hash** on `audit_logs` (SHA-256 chained hashing). It is NOT used for PHI encryption.

> [!WARNING]
> **All tables implement soft-deletes** (`deleted_at TIMESTAMPTZ DEFAULT NULL`). No physical deletes are permitted by any application role.

---

## Proposed Changes

### Migration Infrastructure

We will create a `migrations/` directory under the supabase docker project structure and execute each [.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/jwt.sql) file sequentially against the running `supabase-db` container via `docker exec ... psql`.

#### [NEW] `supabase/docker/volumes/db/migrations/` directory

All 15 migration files live here. They will be executed manually against the running DB, since the Supabase Docker init scripts only run on first boot.

---

### Migration 001: `pgcrypto` Extension + Organizations

#### [NEW] [001_organizations.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/001_organizations.sql)

- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- `organizations` table: `id UUID PK DEFAULT gen_random_uuid()`, `name TEXT NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`, `deleted_at TIMESTAMPTZ`

---

### Migration 002: Hospitals

#### [NEW] [002_hospitals.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/002_hospitals.sql)

- `hospitals`: `id UUID PK`, `organization_id UUID FK → organizations`, `name TEXT NOT NULL`, `nabh_accredited BOOLEAN DEFAULT FALSE`, `jci_accredited BOOLEAN DEFAULT FALSE`, `created_at`, `deleted_at`

---

### Migration 003: Departments

#### [NEW] [003_departments.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/003_departments.sql)

- `departments`: `id UUID PK`, `hospital_id UUID FK → hospitals`, `name TEXT NOT NULL`, `escalation_level INTEGER NOT NULL DEFAULT 1`, `created_at`, `deleted_at`

---

### Migration 004: Users

#### [NEW] [004_users.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/004_users.sql)

- `users`: `id UUID PK DEFAULT gen_random_uuid()`, `auth_user_id UUID UNIQUE` (references `auth.users`), `email TEXT NOT NULL`, `first_name TEXT`, `last_name TEXT`, `role TEXT NOT NULL` with `CHECK (role IN ('patient', 'department_manager', 'quality_coordinator', 'admin', 'medical_superintendent', 'dpo'))`, `department_id UUID FK → departments NULLABLE`, `hospital_id UUID FK → hospitals`, `mfa_enabled BOOLEAN DEFAULT FALSE`, `created_at`, `deleted_at`

---

### Migration 005: On-Call Schedules

#### [NEW] [005_on_call_schedules.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/005_on_call_schedules.sql)

- `on_call_schedules`: `id UUID PK`, `hospital_id UUID FK`, `department_id UUID FK`, `user_id UUID FK → users`, `shift_start TIMESTAMPTZ`, `shift_end TIMESTAMPTZ`, `is_primary_on_call BOOLEAN DEFAULT FALSE`, `created_at`, `deleted_at`
- **Partial Unique Index**: `CREATE UNIQUE INDEX ... ON on_call_schedules (department_id, shift_start) WHERE is_primary_on_call = TRUE`
- **Composite Index**: [(department_id, shift_start, shift_end)](file:///f:/Application%20V4.0/execution/generate_mock_hr_directory.py#140-146)

---

### Migration 006: SLA Configurations

#### [NEW] [006_sla_configurations.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/006_sla_configurations.sql)

- `sla_configurations`: `id UUID PK`, `hospital_id UUID FK`, `department_id UUID FK NULLABLE`, `severity_level TEXT NOT NULL CHECK (...)`, `max_acknowledgement_hours INTEGER NOT NULL`, `max_resolution_hours INTEGER NOT NULL`, `created_at`, `deleted_at`
- `CHECK (max_acknowledgement_hours <= 24)`
- `CHECK (max_resolution_hours <= 720)`

---

### Migration 007: Complaints

#### [NEW] [007_complaints.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/007_complaints.sql)

- `complaints`: `id UUID PK`, `hospital_id UUID FK`, `department_id UUID FK`, `patient_id UUID FK → users`, `assigned_to UUID FK → users NULLABLE`, `parent_complaint_id UUID SELF-FK NULLABLE`, `status TEXT NOT NULL DEFAULT 'submitted'` with `CHECK (status IN ('submitted','acknowledged','investigating','resolved','capa_validated','closed','escalated'))`, `severity_level TEXT`, `sla_deadline TIMESTAMPTZ`, `created_at`, `deleted_at`
- B-tree indexes: [(status, department_id, created_at, sla_deadline)](file:///f:/Application%20V4.0/execution/generate_mock_hr_directory.py#140-146)

---

### Migration 008: Complaint PHI (ALE — BYTEA only)

#### [NEW] [008_complaint_phi.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/008_complaint_phi.sql)

- `complaint_phi`: `id UUID PK`, `complaint_id UUID FK → complaints UNIQUE` (1:1), `description BYTEA NOT NULL`, `reporter_name BYTEA NOT NULL`, `reporter_contact BYTEA NOT NULL`, `created_at`, `deleted_at`
- **No plaintext columns.** All PHI is AES-256-GCM ciphertext.

---

### Migration 009: Complaint Status History (IMMUTABLE)

#### [NEW] [009_complaint_status_history.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/009_complaint_status_history.sql)

- `complaint_status_history`: `id UUID PK`, `complaint_id UUID FK`, `previous_status TEXT`, `new_status TEXT NOT NULL`, `changed_by UUID FK → users`, `created_at`
- **REVOKE UPDATE, DELETE** on this table from all roles

---

### Migration 010: Audit Logs (IMMUTABLE + Ledger Hash)

#### [NEW] [010_audit_logs.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/010_audit_logs.sql)

- `audit_logs`: `id UUID PK`, `table_name TEXT NOT NULL`, `record_id UUID NOT NULL`, `action_type TEXT NOT NULL`, `old_data JSONB`, `new_data JSONB`, `performed_by UUID`, `ledger_hash BYTEA`, `previous_hash BYTEA`, `created_at`
- **REVOKE UPDATE, DELETE** from all roles
- Index: [(record_id, created_at DESC)](file:///f:/Application%20V4.0/execution/generate_mock_hr_directory.py#140-146)

---

### Migration 011: Processed Events

#### [NEW] [011_processed_events.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/011_processed_events.sql)

- `processed_events`: `id UUID PK`, `event_name TEXT NOT NULL`, `event_id TEXT NOT NULL UNIQUE`, `created_at`
- Index on `created_at` for pg_cron purge
- pg_cron job: `DELETE FROM processed_events WHERE created_at < NOW() - INTERVAL '7 days'` nightly at 02:00 IST

---

### Migration 012: Notifications

#### [NEW] [012_notifications.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/012_notifications.sql)

- `notifications`: `id UUID PK`, `user_id UUID FK → users`, `complaint_id UUID FK`, `channel TEXT NOT NULL` (email/sms/in_app), `secure_link_id UUID UNIQUE`, `status TEXT DEFAULT 'pending'`, `delivered_at TIMESTAMPTZ`, `read_at TIMESTAMPTZ`, `created_at`
- **Zero PHI** — only `secure_link_id` is transmitted

---

### Migration 013: SLA Breach Log

#### [NEW] [013_sla_breach_log.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/013_sla_breach_log.sql)

- `sla_breach_log`: `id UUID PK`, `complaint_id UUID FK`, `breached_stage TEXT NOT NULL`, `breach_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()`, `escalated_to UUID FK → users`, `created_at`

---

### Migration 014: Security Alerts

#### [NEW] [014_security_alerts.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/014_security_alerts.sql)

- `security_alerts`: `id UUID PK`, `alert_type TEXT NOT NULL`, `source_table TEXT`, `source_record_id UUID`, `details JSONB`, `resolved BOOLEAN DEFAULT FALSE`, `created_at`
- Write-only from triggers; read-only for DevOps role

---

### Migration 015: Patient Consents

#### [NEW] [015_patient_consents.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/015_patient_consents.sql)

- `patient_consents`: `id UUID PK`, `patient_id UUID FK → users`, `complaint_id UUID FK`, `consent_version TEXT NOT NULL`, `ip_address INET`, `consented_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `withdrawn_at TIMESTAMPTZ`
- Index: [(patient_id, complaint_id)](file:///f:/Application%20V4.0/execution/generate_mock_hr_directory.py#140-146)

---

### Seed Data

#### [NEW] [seed.sql](file:///f:/Application%20V4.0/supabase/docker/volumes/db/migrations/seed.sql)

- Insert 1 organization (Apollo)
- Insert 1 hospital (Apollo Multispeciality)
- Insert 13 departments derived from [mock_staff_directory.csv](file:///F:/Application%20V4.0/.tmp/mock_staff_directory.csv)
- Insert 145 user records from the CSV (using pre-assigned UUIDs, roles, departments)
- Insert default SLA configurations per severity level
- Insert sample on-call schedules

---

## Verification Plan

### Automated Tests

1. **Run all 15 migrations sequentially against the running Supabase DB:**
   ```powershell
   Get-ChildItem "f:\Application V4.0\supabase\docker\volumes\db\migrations\*.sql" | Sort-Object Name | ForEach-Object {
     docker exec -i supabase-db psql -U postgres -d postgres -f "/docker-entrypoint-initdb.d/migrations/$($_.Name)"
   }
   ```

2. **Verify all 14 tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' ORDER BY table_name;
   ```
   Expected: 14 tables listed.

3. **Verify pgcrypto extension:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```

4. **Verify immutable table constraints (audit_logs, complaint_status_history):**
   ```sql
   -- Attempt an UPDATE on audit_logs — should fail with permission denied
   INSERT INTO audit_logs (table_name, record_id, action_type) VALUES ('test', gen_random_uuid(), 'TEST');
   UPDATE audit_logs SET action_type = 'TAMPERED' WHERE action_type = 'TEST';
   -- Expected: ERROR: permission denied
   ```

5. **Verify partial unique index on on_call_schedules:**
   ```sql
   -- Insert two primary on-call for same dept+shift — should fail
   INSERT INTO on_call_schedules (department_id, user_id, shift_start, shift_end, is_primary_on_call, hospital_id)
   VALUES ('<dept_id>', '<user1>', '2026-03-03 08:00+05:30', '2026-03-03 20:00+05:30', TRUE, '<hosp_id>');
   INSERT INTO on_call_schedules (department_id, user_id, shift_start, shift_end, is_primary_on_call, hospital_id)
   VALUES ('<dept_id>', '<user2>', '2026-03-03 08:00+05:30', '2026-03-03 20:00+05:30', TRUE, '<hosp_id>');
   -- Expected: UNIQUE violation on second insert
   ```

6. **Verify seed data counts:**
   ```sql
   SELECT 'organizations' AS tbl, COUNT(*) FROM organizations
   UNION ALL SELECT 'hospitals', COUNT(*) FROM hospitals
   UNION ALL SELECT 'departments', COUNT(*) FROM departments
   UNION ALL SELECT 'users', COUNT(*) FROM users;
   ```
   Expected: 1 org, 1 hospital, 13 departments, 145 users.

7. **Verify CHECK constraints on roles and status:**
   ```sql
   INSERT INTO users (email, role, hospital_id) VALUES ('test@test.com', 'hacker', '<hosp_id>');
   -- Expected: CHECK violation
   ```

### Manual Verification

- **User should open Supabase Studio** at `http://localhost:8000` and visually confirm all 14 tables appear in the Table Editor with correct columns and relationships.
