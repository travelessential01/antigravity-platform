# Sprint 6 Implementation Plan

## Goal Description
Implement Chaos Engineering, Security Hardening & Surveyor Sign-Off for ANTIGRAVITY v4.1. This sprint is the final validation gate before production — all adversarial scenarios must pass with documented proof. It covers load testing, penetration testing, disaster recovery, full OpenTelemetry observability, and a mock surveyor dry run.

## User Review Required

> [!CAUTION]
> Sprint 6 includes **destructive DR testing** (Task 6.3: `DROP TABLE audit_logs CASCADE`). This MUST be executed on an isolated test environment, never the primary development database. Confirm the DR test environment strategy before execution begins.

> [!IMPORTANT]
> Task 6.1 Thundering Herd failure criteria (>5% payload failure or SLA timer duplication) triggers a **rollback to Sprint 5**. Task 6.2 PagerDuty tamper detection failure **blocks Sprint 7**. Task 6.5 surveyor dry run failure (>10 min or developer assistance) **blocks Sprint 7**.

## Proposed Changes

### Load Testing Infrastructure (Task 6.1)

#### [NEW] [k6_concurrent_submissions.js](file:///c:/Application%20V4.0/tests/load/k6_concurrent_submissions.js)
k6 script simulating 1,000 concurrent complaint submissions via Server Actions. Validates P95 < 200ms, zero 5xx, zero pool exhaustion.

#### [NEW] [k6_dashboard_readers.js](file:///c:/Application%20V4.0/tests/load/k6_dashboard_readers.js)
k6 script simulating 100 concurrent dashboard users with mixed role JWTs. Validates cross-department RLS enforcement under load.

#### [NEW] [k6_thundering_herd.js](file:///c:/Application%20V4.0/tests/load/k6_thundering_herd.js)
k6 script simulating 200 offline PWAs x 5 payloads reconnecting in 5-second burst. Validates zero data loss and zero duplicate SLA timers.

---

### Security Testing (Task 6.2)

#### [NEW] [pen_test_suite.ps1](file:///c:/Application%20V4.0/tests/security/pen_test_suite.ps1)
PowerShell script executing the full pen test suite: SQL injection payloads, ALE bypass attempts (patient cross-access, manager cross-department, cross-tenant), role escalation, deep-link replay, and IDOR verification via semgrep.

#### [NEW] [ledger_tamper_test.ps1](file:///c:/Application%20V4.0/tests/security/ledger_tamper_test.ps1)
PowerShell script that tampers a single `audit_logs` entry via `service_role` key and verifies the synchronous trigger → `security_alerts` → SigNoz webhook → PagerDuty incident pipeline fires within 60 seconds.

---

### Disaster Recovery (Task 6.3)

#### [NEW] [dr_simulation.ps1](file:///c:/Application%20V4.0/tests/dr/dr_simulation.ps1)
PowerShell script orchestrating the full DR simulation: insert 50 test complaints, DROP TABLE, WAL-G restore, verify data integrity, measure RPO/RTO. Includes post-recovery `ledger_hash` chain verification.

---

### Observability & APM (Task 6.4)

#### [NEW] [telemetry.ts](file:///c:/Application%20V4.0/src/lib/telemetry.ts)
OpenTelemetry NodeSDK configuration with OTLP gRPC exporter to SigNoz. Registers auto-instrumentation for HTTP/fetch. Exports `tracer` for custom spans.

#### [NEW] [instrumentation.ts](file:///c:/Application%20V4.0/src/instrumentation.ts)
Next.js App Router instrumentation hook that initializes the OpenTelemetry SDK on server startup.

#### [MODIFY] [complaints.ts](file:///c:/Application%20V4.0/src/actions/complaints.ts)
Add OTLP spans around complaint creation, PHI encryption/decryption, and database operations.

#### [MODIFY] [workflow.ts](file:///c:/Application%20V4.0/src/actions/workflow.ts)
Add OTLP spans around status transitions and duplicate detection.

#### [MODIFY] [sla.ts](file:///c:/Application%20V4.0/src/actions/sla.ts)
Add OTLP spans around SLA configuration updates and breach detection.

#### [MODIFY] [audit.ts](file:///c:/Application%20V4.0/src/actions/audit.ts)
Add OTLP spans around audit read operations and ledger verification.

#### [MODIFY] [functions.ts](file:///c:/Application%20V4.0/src/inngest/functions.ts)
Add OTLP spans around all Inngest functions (SLA deadline, escalation, CAPA checkpoint, nightly audit).

---

### Surveyor Dry Run (Task 6.5)

#### [NEW] [sprint_6_seed_data.sql](file:///c:/Application%20V4.0/database/migrations/sprint_6_seed_data.sql)
Comprehensive seed data for Sprint 6 testing: 1,000+ complaints across full lifecycle, 50+ breach records, 100+ consent records, unbroken ledger_hash chain, and a "golden" complaint for the surveyor dry run.

#### [NEW] [surveyor_dry_run_checklist.md](file:///c:/Application%20V4.0/directives/surveyor_dry_run_checklist.md)
Step-by-step checklist for the non-developer surveyor actor to follow during the 7-step dry run, including pre-run setup, timer instructions, and the golden complaint Ticket ID.

---

## Verification Plan

### Automated Tests

1. **Load Testing (Task 6.1)**:
   ```powershell
   # Install k6 if not present
   winget install Grafana.k6
   # Run baseline concurrent test
   k6 run tests/load/k6_concurrent_submissions.js
   # Run dashboard load test
   k6 run tests/load/k6_dashboard_readers.js
   # Run thundering herd simulation
   k6 run tests/load/k6_thundering_herd.js
   ```
   - Verify output: P95 < 200ms, zero errors, all payloads synced.

2. **Security Testing (Task 6.2)**:
   ```powershell
   # Run pen test suite
   .\tests\security\pen_test_suite.ps1
   # Run ledger tamper test
   .\tests\security\ledger_tamper_test.ps1
   # Run semgrep IDOR scan
   semgrep --config=.github/semgrep-rules/ src/actions/
   ```

3. **Observability (Task 6.4)**:
   ```powershell
   # Build Next.js to verify telemetry and instrumentation compile
   pnpm run build
   # Start dev server and trigger a Server Action
   pnpm run dev
   # Verify spans appear in SigNoz UI
   ```

### Manual Verification

1. **DR Simulation (Task 6.3)**: Execute `.\tests\dr\dr_simulation.ps1` on an isolated test Docker environment. Manually verify all 50 complaints restored, ledger_hash chain intact, RPO ≤ 15 min, RTO < 1 hr.

2. **PagerDuty Alert (Task 6.2 & 6.4)**: Tamper an audit_log entry; visually confirm PagerDuty incident appears within 60 seconds. Simulate Inngest queue overload; confirm SigNoz alert fires to PagerDuty.

3. **Surveyor Dry Run (Task 6.5)**: A non-developer team member follows `surveyor_dry_run_checklist.md`. Screen-record the full session. Timer must show all 7 steps completed in < 10 minutes with no step exceeding 2 minutes.
