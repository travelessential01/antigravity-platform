# Sprint 6 Prerequisites: Chaos Engineering, Security Hardening & Surveyor Sign-Off

Before commencing Sprint 6, ensure the following prerequisites are met:

## 1. Sprint 5 Completion Check
- All 8 materialised views (`mv_avg_resolution_time`, `mv_monthly_complaint_trends`, `mv_sla_compliance_percentage`, `mv_department_heatmap`, `mv_capa_effectiveness`, `mv_org_sla_compliance`, `mv_org_complaint_trends`, `mv_org_resolution_benchmarks`) are operational with zero-PHI validation passed (Task 5.1).
- B2B Transparency Widget (SSR embeddable) and Quality Coordinator PDF Export are functional (Task 5.2).
- Dual-Signature CAPA workflow complete; `nightlyComplianceAudit` audit function operational and verified (Task 5.3).
- DPO Investigator UI (`/(dpo)/investigator`) is read-only, connected to Elasticsearch `ap-south-1`, and HIPAA Read-Audit Report generation completes in < 30 seconds (Task 5.4).
- All 4 accreditation reports (NABH PRE.7 Summary, 24-Hour Compliance, SLA Breach Summary, Annual Grievance Export) generate as zero-PHI PDF/CSV (Task 5.5).

## 2. Data Requirements
- **Volume**: `complaints`, `complaint_status_history`, `sla_breach_log`, and `audit_logs` tables must contain **minimum 1,000 realistic records** spanning 6+ months for meaningful load testing (Task 6.1) and surveyor dry run (Task 6.5).
- **Lifecycle Coverage**: Records must cover the full lifecycle (`submitted` → `acknowledged` → `investigating` → `resolved` → `capa_validated` → `closed`) with at least 20 complaints having completed the entire cycle through CAPA closure.
- **SLA Breaches**: At least 50 breach records in `sla_breach_log` with varied `breached_stage` values and escalation chains.
- **Audit Chain**: `audit_logs` must have an unbroken `ledger_hash` chain for all seeded records.
- **Patient Consents**: `patient_consents` must have at least 100 records with valid `consent_version` and `consented_at` timestamps.
- **Notification Records**: `notifications` table must contain delivery receipts for deep-link acknowledgment testing.

## 3. Infrastructure Readiness
- **Self-Hosted Supabase** (Docker): All services running — PostgreSQL, Supavisor, GoTrue Auth, Realtime, Storage, Edge Functions, Kong.
- **Inngest**: Running locally with Dev Server UI accessible; all SLA/escalation/CAPA job functions deployed.
- **SigNoz OpenTelemetry APM**: Container running and receiving spans from Next.js Server Actions (OTLP endpoint `http://[signoz_host]:4317`).
- **PagerDuty Integration**: Webhook configured from SigNoz alerting; Events API v2 integration key validated.
- **Sentry**: Developer tier configured; DSN wired into Next.js for unhandled exception capture.
- **Elasticsearch** (`ap-south-1` or local equivalent): Deployed, accessible, and receiving `audit_reads` events from PHI access.
- **WAL-G**: Continuous archiving operational; `walg backup-list` returns at least one full backup.

## 4. Tooling Requirements
- **Load Testing**: Install `k6` (Grafana k6) or `artillery` for concurrent load and thundering-herd simulation.
- **Security Testing**: Prepare SQL injection payload sets; ensure `semgrep` and `CodeQL` SAST rules are active.
- **DR Testing**: Identify an isolated test environment (or Docker-based clone) for destructive WAL-G DR simulation (DROP TABLE test).

## 5. Access Matrix
- Test accounts must exist for ALL roles: `admin`, `medical_superintendent`, `quality_coordinator`, `department_manager`, `dpo`, and `patient`.
- Each account must have proper JWT claims mapped via Authentik/Keycloak including `department_id` and `hospital_id`.
- Cross-tenant test accounts: at least 2 hospitals under the same organization with separate department mapping.

## 6. CI/CD Pipeline
- SAST (`semgrep`) with HIPAA/PHI ruleset active on all PRs.
- IDOR (`CodeQL`) scanning active on complaint_id and patient_id access paths.
- Branch protection rules enforced on `main`.
