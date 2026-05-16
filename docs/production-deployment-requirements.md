# Antigravity Platform — Final Production Deployment Requirements

**Version:** v4.1 | **Region:** ap-south-1 (Mumbai) | **Date:** 2026-03-16
**Status:** Pre-deployment checklist. All items must be ✅ before cutover.

---

## 1 · Pre-Deployment Code Gates

These must pass in CI before any deployment artifact is built.

- [ ] `npx tsc --noEmit` — exit code 0, zero TypeScript errors
- [ ] `pnpm audit --prod` — `No known vulnerabilities found` (zero HIGH/CRITICAL CVEs)
- [ ] `powershell -File tests/audit-secrets.ps1 -ProductionMode $true` — exit code 0, zero failures
- [ ] `eslint` — zero errors on production-flagged rules
- [ ] semgrep PHI ruleset — zero violations (no raw PHI in API responses)
- [ ] CodeQL IDOR scan — zero violations (no cross-department complaint_id access)

---

## 2 · Infrastructure Provisioning (ap-south-1)

### 2.1 Compute & Networking

- [ ] Production VPC provisioned in `ap-south-1` (Mumbai)
- [ ] All compute nodes within the VPC (no public egress for DB or auth layers)
- [ ] TLS termination at load balancer; internal traffic over private subnets
- [ ] Port 443 (HTTPS), 5432 (Postgres, private), 9200 (Elasticsearch, private) only

### 2.2 Self-Hosted Supabase (Docker Compose)

- [ ] Supabase Docker Compose deployed on production server
- [ ] All 23 migrations run in order (`001` → `023`) with zero errors
- [ ] Migration idempotency verified: re-running migrations produces no errors
- [ ] `supabase-db` container: `healthy`
- [ ] `supabase-auth` container: `healthy`
- [ ] `supabase-rest` container: `healthy`
- [ ] `supabase-pooler` (Supavisor): `healthy` — required for JWT custom claims under transaction mode

### 2.3 WAL-G Continuous Archiving

- [ ] WAL-G installed on production DB server
- [ ] `WALG_S3_PREFIX` set to `s3://[bucket]/antigravity-wal/` in ap-south-1
- [ ] IAM role scoped to the Antigravity service account only (least privilege)
- [ ] `walg backup-push` verified — first backup run completes without error
- [ ] `walg backup-list` — at least one backup within the last 24 hours
- [ ] WAL-G RPO validated: ≤ 15 minutes
- [ ] WAL-G RTO validated: ≤ 1 hour (DR drill required)

### 2.4 Authentik / Keycloak (IdP)

- [ ] Authentik or Keycloak deployed and accessible (internal network only)
- [ ] Production staff directory imported (Employee IDs, emails, departments)
- [ ] All 5 groups configured: `staff`, `quality_coordinator`, `medical_superintendent`, `dpo`, `admin`
- [ ] JWT custom claims mapping verified: `role`, `hospital_id`, `department_id` present in tokens
- [ ] SAML 2.0 / OIDC integration verified against production Supabase Auth
- [ ] TOTP MFA enforced for all groups — no bypass path exists

### 2.5 Inngest

- [ ] Production Inngest API key configured (`INNGEST_EVENT_KEY`)
- [ ] Production webhook URL registered in Inngest dashboard (production app URL)
- [ ] `scheduleSlaBreach` function deployed and verified
- [ ] `escalationWakeUp` function deployed and verified
- [ ] Idempotency via `processed_events` table verified (duplicate event test)

### 2.6 SigNoz APM & Alerting

- [ ] SigNoz production stack deployed (Docker Compose or K8s)
- [ ] OTLP endpoint configured in app (`NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT`)
- [ ] Custom metrics visible in SigNoz dashboard: SLA breach rate, complaint throughput
- [ ] PagerDuty integration active — alert routes configured for:
  - `sla_breach` — severity: critical
  - `ledger_tamper` — severity: critical
  - `auth_failure_burst` — severity: high
- [ ] PagerDuty test alert fired and received by on-call engineer

### 2.7 Elasticsearch (Forensic Audit Ledger)

- [ ] Elasticsearch cluster deployed in `ap-south-1`
- [ ] Index `audit_reads` created with ILM policy (7-year retention)
- [ ] `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` set in secrets manager (not `.env`)
- [ ] Default credentials (`changeme`, `elastic`) replaced with production credentials
- [ ] DPO route connection verified: forensic query returns results from production index

---

## 3 · Secrets Management

> **Rule:** Zero secrets in source code or `.env` files. All secrets via AWS Secrets Manager or equivalent.

- [ ] Remove `.env` file from production server (or exclude via deployment pipeline)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → AWS Secrets Manager
- [ ] `LOCAL_DEV_AES_GCM_KEY` → **replaced** with AWS KMS key fetch (see TODO comments in `complaints.ts`)
- [ ] `PHI_ENCRYPTION_KEY_ID` → real AWS KMS ARN (`arn:aws:kms:ap-south-1:[account]:key/[id]`), scoped to Antigravity IAM role
- [ ] `JWT_SECRET` → minimum 256-bit random secret, rotated from dev value
- [ ] `INNGEST_SIGNING_KEY` → AWS Secrets Manager
- [ ] `ELASTICSEARCH_PASSWORD` → AWS Secrets Manager (not `changeme`)
- [ ] `AUTHENTIK_SECRET_KEY` → AWS Secrets Manager (no placeholder values)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` → updated to production Supabase URL
- [ ] `NEXT_PUBLIC_APP_URL` → production domain (for QR code intake URLs)
- [ ] AWS KMS key policy verified: only Antigravity service IAM role can call `Decrypt`

---

## 4 · Database Verification

- [ ] All 23 migrations applied; `SELECT COUNT(*) FROM schema_migrations` = 23
- [ ] RLS enabled on all 14 tables — verify with:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;
  ```
  Must return **0 rows**.
- [ ] `local_audit_reads` table present with correct schema (Migration 023)
- [ ] `processed_events` table present (Migration 011)
- [ ] `pg_cron` extension active — purge jobs scheduled
- [ ] Materialised views refreshed: `mv_sla_compliance_percentage`, `mv_department_heatmap`, `mv_avg_resolution_time`
- [ ] Ledger hash chain integrity verified (DPO → Ledger Integrity Check passes)
- [ ] Seed data reviewed — no Sprint 6 test/chaos data in production tables

---

## 5 · Application Build & Deployment

- [ ] `pnpm install --frozen-lockfile` in CI to reproduce exact dependency tree
- [ ] `pnpm run build` (`next build --webpack`) completes with zero errors and zero warnings
- [ ] Bundle analysis run (`npm run analyze`) — no unexpected large client chunks
- [ ] Service Worker (`sw.js`) regenerated for production build
- [ ] SW NetworkOnly rules verified for `/api/*`, `/auth/*`, Supabase GoTrue endpoints
- [ ] `pdfmake`, `pdf-lib`, `json2csv` confirmed in `serverExternalPackages` (not in client bundle)
- [ ] Production environment variables injected via secrets manager (not `.env`)

---

## 6 · Security Verification

- [ ] All 4 API auth guards verified:
  - `GET /api/qr/generate` — admin/quality_coordinator/medical_superintendent only
  - `POST /api/dpo/investigator` — dpo/admin only
  - `POST /api/dpo/export-forensic` — dpo/admin only
  - `POST /api/escalation/resolve` — admin/medical_superintendent only
  - `GET /api/export-pdf` — admin/quality_coordinator/dpo/medical_superintendent only
- [ ] ALE PHI decryption verified — plaintext appears only in Server Action response (never in DB, logs, or network)
- [ ] Deep-link token expiry (15 min) verified with replay attack test
- [ ] Replay protection via `processed_events` — duplicate token rejected with 403
- [ ] Session idle timeout (30 min) verified on all clinical routes
- [ ] Rate limiter on `/api/acknowledge` — 5 req/min per IP confirmed
- [ ] Notification status values match DB CHECK constraint (`pending`, `read`, `failed`)

---

## 7 · Compliance Sign-Off

- [ ] NABH PRE.7 compliance report generated for each hospital — values non-zero
- [ ] HIPAA Minimum Necessary audit: all API responses confirmed PHI-free (except authenticated Server Actions)
- [ ] DPDP data localisation: Elasticsearch, Supabase, WAL-G backups all confirmed in `ap-south-1`
- [ ] Audit ledger `patient_id_hash` — no plaintext patient IDs in Elasticsearch
- [ ] JCI mock surveyor dry run passed (all 7 steps < 10 minutes, no developer assistance)
- [ ] CAPA dual-signature workflow verified end-to-end

---

## 8 · QR Code Asset Delivery

- [ ] Production `NEXT_PUBLIC_APP_URL` set correctly (QR codes use this for intake URL)
- [ ] QR codes downloaded for ALL facilities (PNG 300 DPI + SVG)
- [ ] Each QR scanned on a physical device → confirms offline intake form launches
- [ ] QR assets delivered to hospital operations team with print specifications

---

## 9 · Blue-Green Deployment Sequence

```
Stage 1 → 5% traffic (canary)
  ├── Monitor: SigNoz error rate < 0.1%
  ├── Monitor: Inngest job queue length stable
  └── Wait: 30 minutes → no PagerDuty alerts

Stage 2 → 25% traffic
  ├── Monitor: Supabase connection pool utilisation < 70%
  ├── Monitor: DB query latency P99 < 500ms
  └── Wait: 1 hour → no PagerDuty alerts

Stage 3 → 100% traffic
  ├── Decommission old deployment after 48 hours
  └── Final WAL-G backup-list verification
```

- [ ] Stage 1 canary deployed and monitored — no alerts
- [ ] Stage 2 (25%) deployed and monitored — no alerts
- [ ] Stage 3 (100%) cutover executed
- [ ] Vercel plan upgraded from **Hobby** to **Pro** (if using Vercel for edge)
- [ ] Old deployment decommissioned after 48-hour observation window

---

## 10 · Final Sign-Off Checklist

This must be signed by the designated sign-off engineer before the deployment is considered complete.

| System | Check | Status |
|---|---|---|
| Supabase | `docker ps` — `supabase-db` healthy | ☐ |
| Supabase | RLS active on all tables (0 unprotected rows) | ☐ |
| WAL-G | `walg backup-list` — backup within last 24h | ☐ |
| SigNoz | Dashboard green — all metrics tracking | ☐ |
| Inngest | Functions healthy — webhook 200 on test event | ☐ |
| PagerDuty | All alert routes active — test alert received | ☐ |
| Elasticsearch | DPO forensic query returns results | ☐ |
| Secrets | `audit-secrets.ps1 -ProductionMode $true` — exit 0 | ☐ |
| Build | `tsc --noEmit` — exit 0 | ☐ |
| CVE | `pnpm audit --prod` — no vulnerabilities | ☐ |
| QR | All hospital QRs delivered to operations team | ☐ |
| Docs | All 4 clinical training guides delivered | ☐ |

**Sign-off Engineer:** ___________________
**Date/Time:** ___________________
**Build Hash:** ___________________

---

> *All items above derive from directives: antigravity_v4.1.md, Sprint 7, Rule 1–11, and Task 7.1–7.4 implementation.*
