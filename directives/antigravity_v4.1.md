# ANTIGRAVITY — Healthcare Grievance & Compliance Platform

### Master Development Task Artifact
*Refined for JCI • NABH PRE.7 • HIPAA • DPDP Act 2023*
*Version 4.1 — Incorporating V4.1.1 & V4.1.2 Architectural Updates*
*CONFIDENTIAL & PROPRIETARY*

---

| **Engagement Duration** | 15 Weeks (7 Sprints including 3-Week Sprint 1 & Sprint 7 Buffer) |
| --- | --- |
| **Compliance Targets** | NABH 6th Edition PRE.7, JCI, HIPAA, DPDP Act 2023, TRAI/DLT |
| **Primary Stack** | Next.js App Router · Self-Hosted Supabase · Inngest · Yjs · SigNoz |
| **Security Rating** | Enterprise-Grade (MFA, AES-256-GCM ALE, Immutable Ledger, IDOR CI/CD) |
| **Infrastructure Model** | Self-Hosted Supabase (Docker) · WAL-G Backup · ap-south-1 |
| **Identity Provider** | Authentik / Keycloak (Open-Source SAML 2.0) |
| **APM / Observability** | SigNoz (OpenTelemetry) · Sentry · PagerDuty |
| **Version** | 4.1 — Incorporating V4.1.1 & V4.1.2 Architectural Updates |

# Executive Summary

Antigravity is a cloud-native, event-driven healthcare grievance management and compliance intelligence platform engineered to satisfy the audit requirements of NABH 6th Edition (PRE.7), Joint Commission International (JCI), HIPAA, and India's Digital Personal Data Protection (DPDP) Act 2023. The platform replaces manual, reactive grievance workflows with an automated, auditable Compliance Intelligence Engine.

## Platform Mission

-   Transform grievance management from a documentation liability into a proactive quality intelligence asset.

-   Provide cryptographically immutable, surveyor-grade audit trails satisfying simultaneous NABH, JCI, and HIPAA compliance mandates.

-   Deliver real-time SLA enforcement with event-driven escalation, eliminating manual follow-up from clinical quality workflows.

-   Generate B2B-grade zero-PHI analytics for hospital marketing and accreditation transparency.

## Architecture Pillars

| **PHI Separation** | complaint_phi table isolated from workflow metadata. ALL PHI fields encrypted via Application-Level Encryption (AES-256-GCM) in Next.js Server Actions before PostgreSQL. Database stores ciphertext (BYTEA) only — entirely blind to plaintext PHI. |
| --- | --- |
| **Immutable Ledger** | pgcrypto chained hash on audit_logs. Synchronous trigger computes ledger_hash = sha256(new_data || previous_hash) within each transaction. Advisory locking serialises under high concurrency. Tamper triggers Supabase Webhook → SigNoz / PagerDuty. |
| **Event-Driven SLA** | Inngest durable job queues compute exact deadline timestamps — O(1) scheduling, no polling. SigNoz OpenTelemetry APM monitors queue health. |
| **Offline Resilience** | Dual-Phase PWA Background Sync for patients. Yjs CRDTs for staff dashboard in hospital dead zones. AES-GCM encrypted JWT caching. |
| **Zero-Trust Security** | Supavisor transaction pooling + JWT Custom Claims for RLS. ALE-enforced PHI access control in Server Actions. SAST/IDOR in CI/CD. |
| **DPDP Compliance** | PHI read-audits and media evidence routed to ap-south-1 India-localised storage. Consent captured at ingestion. WAL-G backup archive also targets ap-south-1. |
| **Self-Hosted Infrastructure** | Supabase self-hosted via Docker Compose throughout development and production. WAL-G continuous archiving to ap-south-1 S3 for PITR. Full data-residency control satisfying DPDP localisation requirements. |

# System Architecture Overview

## 1.1 Logical Layer Stack

| **Client Layer** | Patient Portal (Dual-Phase PWA) · Staff Dashboard (Offline CRDT) · Admin Console · DPO Forensic Investigator |
| --- | --- |
| **Application Layer** | Next.js 14 App Router · Server Actions (Zod-validated) · Workflow Engine · SLA Engine · Escalation Engine |
| **Backend Layer** | Self-Hosted Supabase PostgreSQL + Supavisor · RLS (JWT Custom Claims) · Audit Triggers · Deno Edge Functions |
| **Infrastructure Layer** | pgcrypto (ledger hash only) · AES-256-GCM ALE (PHI) · DevSecOps CI/CD (semgrep/CodeQL) · Inngest · WAL-G + S3 ap-south-1 · SigNoz APM |

## 1.2 Complete Database Schema (14 Tables)

Every table implements soft-deletes (deleted_at) for auditability. PHI is partitioned from workflow metadata. All PHI fields are AES-256-GCM encrypted at the application layer — the database stores ciphertext BYTEA only.

## Core Tables

-   organizations — Multi-tenancy root (id, name, created_at, deleted_at)

-   hospitals — Per-facility config with NABH_accredited, JCI_accredited booleans linked to organization_id

-   departments — Hospital departments with escalation_level and hospital_id FK

-   users — Supabase auth ref; role as TEXT (no ENUM); mfa_enabled; department_id nullable

## Scheduling & Configuration Tables

-   on_call_schedules — Shift-aware routing backbone (hospital_id, department_id, user_id, shift_start, shift_end, is_primary_on_call)
-   CONSTRAINT: Partial Unique Index on (department_id, shift_start) WHERE is_primary_on_call = TRUE

-   INDEXES: Composite index on (department_id, shift_start, shift_end) for O(1) escalation routing

-   RLS: Users may only SELECT schedules for their own department_id
-   sla_configurations — Runtime thresholds (hospital_id, department_id nullable, severity_level, max_acknowledgement_hours, max_resolution_hours)
-   max_acknowledgement_hours UI MAX: 24h; max_resolution_hours UI MAX: 720h (30 days) per NABH PRE.7

-   SLAs operate on strict Calendar Hours (24/7) — clinical risk does not pause for weekends

## Workflow Tables

-   complaints — Workflow metadata only, NO PHI. Includes parent_complaint_id self-FK and full status enum
-   Status Enum: submitted / acknowledged / investigating / resolved / capa_validated / closed / escalated
-   complaint_phi — 1:1 with complaints. All three fields stored as AES-256-GCM ciphertext (BYTEA)
-   Encryption/decryption exclusively in Next.js Server Actions — database stores ciphertext only

-   Access controlled at Server Action layer via JWT department claim validation (SECURITY DEFINER removed)
-   complaint_status_history — IMMUTABLE; no UPDATE or DELETE; trigger-populated on every status transition

## Audit & Compliance Tables

-   audit_logs — IMMUTABLE; ledger_hash = sha256(data || previous_hash) via synchronous pgcrypto trigger

-   processed_events — Idempotency guard for Edge Functions; pg_cron purge after 7 days

-   security_alerts — Write-only from triggers; read-only for DevOps role

-   patient_consents — DPDP/HIPAA legal basis (patient_id, complaint_id, consent_version, ip_address, consented_at, withdrawn_at nullable)

## Operational Tables

-   notifications — Zero PHI; secure_link_id deep-links; delivery receipt tracking

-   sla_breach_log — Every breach event with breached_stage, timestamp, escalated_to for JCI audit trail

# Sprint 1 — Core Database Foundation & DevSecOps

**EXTENDED: 3 WEEKS | DB Architect (Lead) + Security Engineer + DevOps Engineer | Risk: CRITICAL**

OBJECTIVE: Establish the compliance-ready database foundation with ALE-enforced PHI encryption, immutable audit architecture, self-hosted Supabase, and automated security pipeline before any application code is written.

| **TASK 1.0** | **DevSecOps, CI/CD Pipeline & Self-Hosted Supabase Initialisation** | *DevOps Engineer* | **CRITICAL** |
| --- | --- | — | --- |

## UPDATED v4.1 — Self-Hosted Supabase (Docker) + WAL-G PITR + SigNoz replaces Datadog

## Self-Hosted Supabase Setup (Complete First)

-   Clone the official Supabase self-hosting repo and configure Docker Compose for the development environment
-   docker compose up -d starts PostgreSQL, Supavisor, GoTrue Auth, Realtime, Storage, Edge Functions, Kong

-   Bind all services to internal network; expose only Kong API Gateway on a controlled port

-   Configure .env with ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET (minimum 40-char random), and SITE_URL
-   Configure Supavisor transaction pool immediately after Docker Compose is operational
-   CRITICAL: Do NOT use session-level set_config() for RLS — fails under transaction mode

-   Validate: RLS tenant isolation must use auth.jwt() Custom Claims exclusively

## WAL-G Continuous Archiving (Before Any Data is Written)

-   Install WAL-G on the PostgreSQL container or sidecar
-   Set WALG_S3_PREFIX=s3://\[bucket\]/antigravity-walg pointing to ap-south-1 S3 bucket

-   Set archive_mode = on and archive_command = 'WAL-G wal-push %p' in postgresql.conf

-   Set wal_level = replica to enable WAL shipping
-   Schedule nightly full backup via cron: walg backup-push \$PGDATA at 01:00 IST

-   Validate: walg backup-list must return at least one completed backup before Sprint 1 ends

## CI/CD Pipeline

-   Configure GitHub Actions SAST pipeline using semgrep with HIPAA/PHI ruleset
-   Rule: Block any PR containing raw plaintext PHI variable names in Server Actions

-   Rule: Block any PR with direct DB access bypassing auth.uid() validation

-   Rule: Block any PR calling pgp_sym_encrypt() on complaint_phi columns — ALE replaces all DB-level PHI encryption
-   Configure CodeQL for IDOR scanning on all complaint_id and patient_id access paths

-   Connect GitHub main branch with branch protection rules

## SigNoz OpenTelemetry APM (Replaces Datadog)

-   Deploy SigNoz via Docker Compose (docker compose -f sigNoz/deploy/docker/clickhouse-setup/docker-compose.yaml up -d)

-   Configure OTLP endpoint: http://\[sigNoz_host\]:4317 — full instrumentation wired in Sprint 6

-   Configure PagerDuty webhook from SigNoz alerting for tamper detection and SLA breach events

**Deliverable: Self-hosted Supabase operational; WAL-G archiving validated; SAST pipeline blocks PHI-exposing PRs; SigNoz collector receiving heartbeats**

| **TASK 1.1** | **Schema Design & SQL Migration Setup** | *Database Architect* | **CRITICAL** |
| --- | --- | — | --- |

## UPDATED v4.1 — ALE replaces pgcrypto TDE for PHI; Migration 008 rewritten to BYTEA

## ALE Key Management (Before Any Table Creation)

-   Provision AES-256-GCM encryption keys: AWS KMS (ap-south-1) or HashiCorp Vault
-   Keys must NEVER be hardcoded in source or plain .env files

-   PHI_ENCRYPTION_KEY_ID environment variable points to KMS key ARN or Vault path

-   Define key rotation schedule; re-encryption of complaint_phi ciphertext must be scripted and tested
-   Install pgcrypto FIRST — retained for ledger_hash functions, NOT for PHI encryption
-   Command: CREATE EXTENSION IF NOT EXISTS pgcrypto;

## SQL Migrations

-   Migration 001: Create organizations table (multi-tenancy root)

-   Migration 002: Create hospitals table with organization_id FK and NABH/JCI booleans

-   Migration 003: Create departments table with hospital_id FK and escalation_level

-   Migration 004: Create users table — role as TEXT (no PostgreSQL ENUM)

-   Migration 005: Create on_call_schedules with PARTIAL UNIQUE INDEX on (department_id, shift_start) WHERE is_primary_on_call = TRUE

-   Migration 006: Create sla_configurations with hospital_id, department_id nullable, severity_level, max hours

-   Migration 007: Create complaints table with parent_complaint_id self-FK and full status enum including capa_validated

-   **Migration 008 (ALE — REWRITTEN): Create complaint_phi with BYTEA ciphertext columns**
-   description BYTEA NOT NULL — AES-256-GCM ciphertext; plaintext NEVER stored in DB

-   reporter_name BYTEA NOT NULL — AES-256-GCM ciphertext

-   reporter_contact BYTEA NOT NULL — AES-256-GCM ciphertext

-   Encryption/decryption exclusively in Next.js Server Actions via Node.js crypto.subtle

-   Semgrep rule from Task 1.0 will BLOCK any PR calling pgp_sym_encrypt() on these columns
-   Migration 009: Create complaint_status_history as IMMUTABLE (REVOKE UPDATE, DELETE)

-   Migration 010: Create audit_logs as IMMUTABLE with ledger_hash column (pgcrypto retained here)

-   Migration 011: Create processed_events with 7-day pg_cron purge job

-   Migration 012: Create notifications (zero PHI — secure_link_id only)

-   Migration 013: Create sla_breach_log

-   Migration 014: Create security_alerts — write-only from triggers, read-only for DevOps role

-   Migration 015: Create patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at, withdrawn_at)

**Deliverable: 15 migrations verified on 10k mock records; semgrep confirms Migration 008 stores BYTEA only**

| **TASK 1.2** | **Indexing Strategy** | *Database Architect* | **HIGH** |
| --- | --- | — | --- |

-   complaints: B-tree index on status, department_id, created_at, sla_deadline

-   on_call_schedules: Composite B-tree index on (department_id, shift_start, shift_end)
-   Validate: Full index scan on department with 2,000 schedule rows must resolve under 5ms
-   patient_consents: Index on (patient_id, complaint_id) for consent verification at intake

-   audit_logs: Index on (record_id, created_at DESC) for DPO timeline queries

-   processed_events: Index on created_at for pg_cron purge efficiency

-   Validate all query plans with EXPLAIN ANALYZE on 10k records before Sprint 2 begins

**Deliverable: EXPLAIN ANALYZE output for all critical indexes; all sub-5ms on 10k records**

| **TASK 1.3** | **Row Level Security (RLS) Implementation** | *Database Architect + Security Engineer* | **CRITICAL** |
| --- | --- | — | --- |

## UPDATED v4.1 — SECURITY DEFINER function removed; PHI access control shifts to ALE Server Action layer

-   Enable RLS on ALL 14 tables — no table may be accessible without explicit policy

-   Patient RLS: INSERT own complaint; SELECT only where patient_id = auth.uid(); UPDATE nothing

-   Department Manager RLS on complaints: SELECT where department_id = own department via JWT claim

-   Department Manager access to complaint_phi: Controlled at Server Action layer
-   SECURITY DEFINER function get_phi_for_manager() is REMOVED — pgcrypto TDE no longer applies to PHI columns

-   Server Action get_phi_for_complaint() validates auth.uid() JWT department claim against complaints.department_id BEFORE ALE decryption

-   RLS policy on complaint_phi: SELECT only where complaint_id IN (SELECT id FROM complaints WHERE department_id matches JWT claim)

-   SAST semgrep rule: no Server Action may return decrypted PHI without a preceding department claim check
-   Quality Coordinator: SELECT all complaints within hospital_id — no DELETE

-   DPO: Read-only on audit_logs — no access to complaint_phi directly

-   Medical Superintendent: Read-only executive view across hospital — no PHI

-   Admin: Full read/UPDATE; soft-delete ONLY; REVOKE UPDATE/DELETE on immutable tables

-   on_call_schedules RLS: Users may only SELECT schedules for their own department_id

-   Global REVOKE: No role may execute DELETE on any table

-   Supavisor Validation Test: Run all RLS policies through transaction pool with 50 concurrent sessions

**Deliverable: RLS validation report; cross-tenant isolation proof; ALE Server Action PHI access control proof**

| **TASK 1.4** | **Immutable Audit Triggers & Offshore Data Routing** | *Database Architect + DevOps Engineer* | **CRITICAL** |
| --- | --- | — | --- |

**SYNCHRONOUS TRIGGER ARCHITECTURE IS RETAINED. No batching or async decoupling is applied. Sequential hashing is a compliance requirement.**

-   Trigger 1: ON UPDATE complaints.status → INSERT into complaint_status_history (previous_status, new_status, changed_by, timestamp)

-   Trigger 2: ON INSERT/UPDATE/DELETE on all core tables → INSERT into audit_logs with JSON diff and ledger_hash
-   ledger_hash = pgcrypto digest(NEW.data || previous_hash, 'sha256') — computed synchronously within the same transaction

-   Advisory locking (SELECT pg_advisory_xact_lock()) within the trigger serialises hash chain writes under high concurrency
-   Trigger 3: ON ledger_hash MISMATCH → INSERT into security_alerts + fire Supabase Webhook to SigNoz / PagerDuty

-   REVOKE UPDATE, DELETE on audit_logs and complaint_status_history from ALL roles including superuser

-   pg_cron: DELETE FROM processed_events WHERE created_at \< NOW() - INTERVAL '7 days' — nightly at 02:00 IST

## DPDP Data Residency

-   PHI read-audits must NOT be stored in PostgreSQL — route via Next.js Edge Middleware → S3 / Elasticsearch in ap-south-1

-   Media evidence → self-hosted Supabase Storage (ap-south-1 bound) → signed URLs (15-min expiry) only

-   WAL-G backup archive also targets ap-south-1 S3 — all backup data within India satisfying DPDP localisation

**Deliverable: Superuser UPDATE triggers PagerDuty alert within 500ms; advisory lock performance validated under 50 concurrent writes**

# Sprint 2 — Authentication & Clinical Design System

**2 WEEKS | Security Engineer + Frontend Architect | Risk: HIGH**

OBJECTIVE: Build the complete identity and session governance layer alongside the foundational clinical UI framework.

| **TASK 2.1** | **Next.js Foundation & Clinical Design System** | *Frontend Architect* | **HIGH** |
| --- | --- | — | --- |

-   Initialize Next.js 14 App Router: npx create-next-app@latest ./ \--typescript \--tailwind \--eslint \--app

-   Initialize Shadcn UI: npx shadcn@latest init (Select: Slate theme, CSS Variables)

-   Configure Tailwind clinical HSL color palette (WCAG 2.1 AA):
-   Light Background: hsl(210,40%,98%) — clinical white; Dark Background: hsl(222.2,84%,4.9%) — ICU mode

-   Brand Blue: hsl(214,100%,45%); Patient Calm: hsl(175,40%,40%)

-   Severity Critical: hsl(348,83%,47%); High: hsl(24,94%,50%); Medium: hsl(38,92%,50%); Low: hsl(215,16%,47%)
-   Scaffold role-based directory architecture: app/(patient)/intake, app/(staff)/dashboard, app/(admin)/settings, app/(dpo)/investigator

-   Build atomic UI primitives: SLA Severity Badges, Clinical Buttons (min 48px), Input error states, Skeleton loaders

-   Configure Zustand store slices: useAuthStore, useOfflineQueueStore, useSlaStore

-   Set up dark mode CSS variable inversion — all components must honor dark class

-   Deployment: Vercel Hobby tier throughout development sprints; upgrade to Pro at Task 7.4 production cutover

**Deliverable: Design system Storybook with all clinical primitives; WCAG AA audit pass**

+---------------------------------------------------------------------------------------------------------------------------------------+
| **PRE-TASK 2.2 — Employee ID Synchronisation (New in v4.1)**                                                                        |
|                                                                                                                                       |
| Before SSO configuration begins, the hospital IT team must deliver a structured directory export for IdP group mapping.               |
|                                                                                                                                       |
| -   Export all staff User Principal Names (UPNs) and Object IDs from the hospital HR/Active Directory system                          |
|                                                                                                                                       |
| -   Structure by Organisational Unit — prioritise: Quality, Operations, Procurement departments first                               |
|                                                                                                                                       |
| -   Map each OU to Antigravity role (Quality → quality_coordinator, Dept Head → department_manager, etc.)                             |
|                                                                                                                                       |
| -   Load mapping into Authentik/Keycloak group definitions before Task 2.2 SAML integration begins                                    |
|                                                                                                                                       |
| -   **Deliverable: Verified staff directory CSV with UPN, department, and mapped Antigravity role — reviewed by Security Engineer** |
+---------------------------------------------------------------------------------------------------------------------------------------+

| **TASK 2.2** | **Authentik / Keycloak SAML 2.0 SSO Integration** | *Security Engineer* | **HIGH** |
| --- | --- | — | --- |

## UPDATED v4.1 — Microsoft Entra ID / Azure AD replaced by Authentik or Keycloak (open-source SAML 2.0)

-   Enable email/password login with self-hosted Supabase GoTrue

-   Deploy Authentik (recommended) or Keycloak as the SAML 2.0 Identity Provider via Docker Compose

-   Configure SAML 2.0 SP metadata in GoTrue and IdP metadata in Authentik/Keycloak:
-   SP Entity ID: https://\[supabase_host\]/auth/v1/sso/saml/metadata

-   ACS URL: https://\[supabase_host\]/auth/v1/sso/saml/acs

-   Configure attribute mapping: email, department → department_id, role_group → app_role
-   Map Authentik/Keycloak groups → Antigravity roles using staff directory export (Pre-Task 2.2):
-   ANTIGRAVITY_QUALITY → quality_coordinator; ANTIGRAVITY_DEPT_MANAGER → department_manager

-   ANTIGRAVITY_ADMIN → admin; ANTIGRAVITY_MED_SUPT → medical_superintendent; ANTIGRAVITY_DPO → dpo
-   Configure JWT expiry (30-min access token) and refresh token rotation

-   Offline JWT Caching — AES-GCM via Web Crypto API (MANDATORY):
-   Encrypt JWT before writing to IndexedDB using window.crypto.subtle (AES-GCM, 256-bit)

-   PROHIBITED: Raw Base64 JWT storage in IndexedDB or localStorage

**Deliverable: SSO demo with Authentik/Keycloak group → role mapping proof; JWT custom claims visible in Supabase session**

| **TASK 2.3** | **Multi-Factor Authentication Enforcement** | *Security Engineer* | **HIGH** |
| --- | --- | — | --- |

-   Enable TOTP (authenticator app) and SMS fallback for MFA

-   MANDATORY MFA for: Admin, Quality Coordinator, Medical Superintendent, Department Manager (PHI access roles)

-   Patient role: MFA optional (OTP via mobile number is primary authentication)

-   Log all MFA challenge events to audit_logs for surveyor tracking

**Deliverable: MFA enforcement proof — role-based MFA gate screenshot**

| **TASK 2.4** | **Server Action Security & Session Governance** | *Security Engineer + Backend Engineer* | **HIGH** |
| --- | --- | — | --- |

## UPDATED v4.1 — ALE PHI access pattern defined here as mandatory template for all sprints

-   All data access via Next.js Server Actions ONLY — no public REST endpoint exposure

-   Every Server Action must validate auth.uid() before any database operation

-   **ALE PHI Access Pattern — MANDATORY in every Server Action reading complaint_phi:**
-   Step 1: Validate auth.uid() and JWT department_id claim against complaints.department_id

-   Step 2: Fetch BYTEA ciphertext from complaint_phi via RLS-validated query

-   Step 3: Decrypt using AES-256-GCM with key retrieved from KMS (never from env directly in prod)

-   Step 4: Return decrypted plaintext only to the authenticated caller — never log or cache plaintext

-   Step 5: Fire audit_reads event to offshore Elasticsearch in ap-south-1
-   Zod schema validation on every input; rate limiting at 100 req/min per IP

-   HIPAA 30-Minute Idle Timeout on all clinical dashboard routes; patient intake route exempt

-   Log all security events to audit_logs: login_success, login_failure, mfa_challenge, session_timeout, role_escalation_attempt

**Deliverable: Session timeout demo; ALE decryption path unit test proving plaintext never touches DB layer**

# Sprint 3 — Complaint Intake, SLA & Workflow Engine

**2 WEEKS | Backend Engineer + Frontend Architect | Risk: HIGH**

OBJECTIVE: Build the complete patient intake experience (offline-first, multilingual, consent-capturing) alongside the full SLA scheduling engine, status lifecycle validator, duplicate detection, and Wake-Up escalation protocol.

| **TASK 3.1** | **Patient Intake UI — Offline-First & Zero-Friction** | *Frontend Architect* | **HIGH** |
| --- | --- | — | --- |

## UPDATED v4.1 — QR Code Physical-to-Digital Bridge added; OTP test-environment skip documented

-   Implement next-pwa Service Workers — cache all /(patient)/intake static assets for offline use

-   IndexedDB Sync Queue Architecture:
-   On offline submission: persist complaint JSON to IndexedDB with SHA-256 deduplication hash (patient_id + description + timestamp)

-   Offline UX: Submit button transitions to 'Queue for Sync' with spinner

-   Persistent toast: 'Saved securely. Will sync when connection returns.'
-   IndexedDB CRDT Schema Design — MUST be finalised in Sprint 3 (changing in Sprint 4 breaks existing offline devices)

-   Dual-Phase PWA Background Sync:
-   Phase 1: Sync text metadata first; Phase 2: Upload media after navigator.connection.effectiveType === '4g'

-   Exponential backoff with jitter: delay = min(cap, base \* 2\^attempt) + random(0, 1000ms)
-   Patient form clinical UX: single-column; min 48px touch targets; inputmode='numeric' for mobile; Bengali and Hindi i18n

-   Passwordless OTP authentication: mobile → 6-digit OTP → auto-provision user
-   **OTP TESTING BYPASS EXCEPTION (Sprints 1-7):** During all test and development phases, skip the SMS gateway/OTP verification step. Assume OTP is automatically successful (e.g., using a fixed code like `123456`) until Sprints are completely finalized and integration for production begins.
-   DPDP/HIPAA Consent Module (MANDATORY): consent checkbox with version string; INSERT patient_consents BEFORE writing complaint_phi

-   **QR Code Physical-to-Digital Bridge (New in v4.1):**
-   Hospital-specific QR encodes deep-link to /(patient)/intake?hospital_id=\[uuid\] — pre-populates facility field

-   Printed on inside flap of patient welcome kit boxes — enables bedside submission without staff distribution

-   QR must resolve to Service Worker-cached offline form — functional without network after first load

-   QR asset generation is a sub-task of Task 7.4 — one per hospital, generated at production deployment

-   Validation: Scan QR on 3G-throttled connection — intake form must load within 5 seconds

**Deliverable: Offline intake demo (submit, go offline, verify queue, reconnect, verify sync); QR scan test on 3G simulation**

| **TASK 3.2** | **Status Lifecycle Engine & Duplicate Merge** | *Backend Engineer* | **HIGH** |
| --- | --- | — | --- |

-   Status state machine: submitted→acknowledged→investigating→resolved→capa_validated→closed

-   Invalid transitions throw validated error and log attempted violation to audit_logs

-   Every valid transition INSERTs into complaint_status_history (trigger fires automatically)

-   Duplicate Merge Logic:
-   On new submission: query complaints WHERE patient_id = NEW.patient_id AND created_at \> NOW() - INTERVAL '10 minutes'

-   Compute text similarity via pg_trgm at application layer (after ALE decryption in Server Action)

-   If similarity \> 0.85: set parent_complaint_id = existing; set new complaint status = 'closed'

-   Merged complaint SLA timer does NOT start; audit trail preserved in complaint_status_history

**Deliverable: 10 valid transitions + 5 invalid rejection proofs**

| **TASK 3.3** | **SLA Engine — Event-Driven Scheduling via Inngest** | *Backend Engineer* | **HIGH** |
| --- | --- | — | --- |

-   On complaint INSERT: query sla_configurations → calculate sla_deadline → UPDATE complaints → inngest.send()

-   Inngest fires exact HTTP callback at sla_deadline — O(1), no polling

-   Early resolution: inngest.cancel({ name: 'sla/deadline', id: complaint_id })

-   processed_events checked FIRST before any side-effect — idempotency on retries

-   Inngest free tier (100,000 events/month) used throughout development sprints

-   SigNoz OTel spans on Inngest functions; alert if queue depth \> 100 unprocessed events

-   sla_deadline uses TIMESTAMPTZ — timezone-aware for IST operations

**Deliverable: Inngest dashboard showing scheduled SLA job; cancellation demo on early resolution**

| **TASK 3.4** | **Escalation Engine & 15-Minute Wake-Up Protocol** | *Backend Engineer* | **HIGH** |
| --- | --- | — | --- |

-   On Inngest SLA breach callback: INSERT sla_breach_log → identify primary on-call → generate signed deep-link → dispatch notification

-   15-Minute Wake-Up: secondary Inngest job fires 15 min after primary if deep-link not clicked

-   Deep-link click: UPDATE notifications.status = 'Read' → Inngest cancels wake-up job

-   Wake-up pivot: notify secondary on-call manager; log to sla_breach_log with escalated_to = secondary_manager_id

-   Escalation chain: Department Manager → Quality Coordinator if secondary also fails (30-min total window)

**Deliverable: End-to-end escalation simulation — breach, 15-min pivot, sla_breach_log chain verified**

# Sprint 4 — Realtime, Notifications & Staff Offline UI

**2 WEEKS | Backend Engineer + Frontend Architect | Risk: MEDIUM**

OBJECTIVE: Deliver the real-time staff operational dashboard, staff offline CRDT resolution, multi-channel notification engine with TRAI/DLT compliance, and Dynamic SLA Configuration UI.

| **TASK 4.1** | **Zero-PHI Quality Dashboard & Staff Offline Resilience** | *Frontend Architect* | **MEDIUM** |
| --- | --- | — | --- |

## UPDATED v4.1 — PHI modal uses ALE Server Action decryption pattern

-   TanStack Table + Shadcn DataTable: Ticket ID, Department, Severity Badge, SLA Countdown, Status, Assigned Staff, Actions

-   Critical SLAs (\< 2 hours): structurally hoisted to top of viewport; breached SLAs: red left-border + pulsing Framer Motion animation + CRITICAL text + warning icon

-   Color independence: urgency communicated by color AND icon AND text label simultaneously

-   Secondary-Click PHI Modal:
-   Dashboard shows ONLY: Ward, Urgency Badge, Category, SLA Countdown — zero PHI visible

-   'View Details' triggers modal with MFA re-confirmation prompt

-   Modal invokes ALE Server Action: validates JWT → fetches BYTEA → decrypts AES-256-GCM → renders plaintext

-   Modal opening fires audit_reads to offshore Elasticsearch in ap-south-1
-   Dynamic SLA Configuration UI (MANDATORY SPRINT 4):
-   Slider for max_acknowledgement_hours (\<=24) and max_resolution_hours (\<=720) with inline NABH validation

-   On save: UPDATE sla_configurations → Inngest triggers CONCURRENT materialized view refresh
-   Staff Offline CRDT Resolution: Yjs Y.Doc per complaint_id; on reconnect Yjs syncs with Supabase Realtime

**Deliverable: Offline staff update demo; ALE PHI modal decryption proof; NABH SLA ceiling validation**

| **TASK 4.2** | **Supabase Realtime Subscriptions & WebSocket RLS** | *Backend Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Subscribe to: complaints (metadata only), notifications, sla_breach_log

-   Each WebSocket passes JWT — Realtime inherits RLS from auth.jwt() claims

-   Ward Nurses: events for their department_id only; Quality Coordinators: entire hospital_id; cross-tenant isolation absolute

-   SLA breach INSERT → useSlaStore.hoist(complaint_id) → React re-renders card to top of DataTable instantly

**Deliverable: SLA breach triggers instant card hoist without page refresh**

| **TASK 4.3** | **Multi-Channel Notification Engine** | *Backend Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Three Deno Edge Functions on self-hosted Supabase: onComplaintCreated, onSlaBreach, nightlyComplianceAudit

-   **Notification PHI Rule — ABSOLUTE: ALL channels (email, SMS, in-app) contain ZERO PHI**

-   Only secure_link_id transmitted — requires authenticated session to resolve complaint details

-   1-Click Deep-Link: JWT-signed, single-use, 15-min TTL; rate limit 5 req/min on /api/acknowledge

-   On click: UPDATE complaint → acknowledged; Inngest cancels SLA job; notifications.status = 'Read'

-   TRAI/DLT Compliance: pre-approved DLT Template IDs embedded in every SMS; MSG91 primary, Twilio fallback

-   Shift-aware routing: query on_call_schedules before dispatching; default to Quality Coordinator if no active shift

-   Idempotency: check processed_events before dispatching — prevents duplicates on Edge Function retry

**Deliverable: E2E demo — breach → shift-aware SMS → 1-click acknowledge → SLA timer stops**

# Sprint 5 — Analytics, Compliance & Accreditation Dashboard

**2 WEEKS | Compliance Engineer + Frontend Architect | Risk: MEDIUM**

OBJECTIVE: Build the analytics layer — hospital-level and organisation-level metrics, B2B transparency widgets, CAPA effectiveness, DPO forensic investigator UI, and accreditation report generator.

| **TASK 5.1** | **Materialised Views — PHI-Stripped Analytics** | *Compliance Engineer + Database Architect* | **MEDIUM** |
| --- | --- | — | --- |

-   Hospital-Level Views (zero-PHI): mv_avg_resolution_time, mv_monthly_complaint_trends, mv_sla_compliance_percentage, mv_department_heatmap, mv_capa_effectiveness

-   Organisation-Level Views: mv_org_sla_compliance, mv_org_complaint_trends, mv_org_resolution_benchmarks — restricted to Admin/Medical Superintendent

-   Hybrid Refresh: Inngest event trigger on complaint closed or sla_breach INSERT; nightly Inngest cron at 02:30 IST — all REFRESH MATERIALIZED VIEW CONCURRENTLY

-   PHI validation: SAST scan confirms no view returns patient_id, description, reporter_name, or reporter_contact

**Deliverable: EXPLAIN ANALYZE proof showing zero PHI columns in result set**

| **TASK 5.2** | **B2B Transparency Widgets & Marketing Integration** | *Frontend Architect* | **MEDIUM** |
| --- | --- | — | --- |

-   SEO-optimised SSR Transparency Widget reading from mv_sla_compliance_percentage; embeddable \<script\> for hospital LinkedIn/Google Business

-   Quality Coordinator PDF Export: 30-day resolution report, PHI-stripped, server-side, hospital-branded

-   Organisation Dashboard (Bento grid): cross-facility SLA compliance; drill-down to hospital-level

**Deliverable: Working embedded widget + PDF export with PHI-zero audit proof**

| **TASK 5.3** | **CAPA Validation Engine & Compliance Rule Engine** | *Compliance Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Dual-Signature CAPA: on capa_validated transition, Inngest schedules 30-day checkpoint; Quality Coordinator must click 'Sign & Close CAPA' stored as audit_logs entry

-   Nightly Compliance Checks via nightlyComplianceAudit: 24h acknowledgment breaches, NULL escalations, stuck investigating tickets, CAPA signature gaps

-   CAPA Effectiveness Overlay: mv_capa_effectiveness computes volume 30d pre vs 30d post-CAPA; overlaid as vertical markers on monthly trend graph

**Deliverable: CAPA effectiveness chart with intervention overlay; nightly audit digest demo**

| **TASK 5.4** | **DPO Forensic Read-Audit Investigator UI** | *Frontend Architect + Compliance Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   /(dpo)/investigator connects to offshore Elasticsearch ap-south-1 (not PostgreSQL)

-   Filters: staff_id, patient_id (anonymised), date_range, action_type; infinite scroll with server-side pagination

-   ZERO action buttons — read-only enforced at API endpoint (GET only)

-   'Generate HIPAA Read-Audit Report' PDF completes in \< 30 seconds for 12-month range

**Deliverable: Filter, display timeline, verify read-only enforcement**

| **TASK 5.5** | **Accreditation Report Generator** | *Compliance Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Generate on demand (PDF + CSV): NABH PRE.7 Summary, 24-Hour Compliance, SLA Breach Summary, Annual Grievance Export

-   All reports pass SAST scan for zero PHI before file generation completes

**Deliverable: All 4 report types generated and verified zero-PHI**

# Sprint 6 — Chaos Engineering, Security Hardening & Surveyor Sign-Off

**2 WEEKS | QA + Security + DevOps + Privacy Engineers | Risk: CRITICAL**

OBJECTIVE: Validate the platform is attack-resistant, disaster-recoverable, and surveyable. All adversarial scenarios must pass with documented proof before Sprint 7 begins.

| **TASK 6.1** | **Load & Thundering Herd Chaos Testing** | *QA Engineer + DevOps Engineer* | **CRITICAL** |
| --- | --- | — | --- |

-   Baseline: 1,000 concurrent complaint submissions, 100 simultaneous dashboard users; P95 \< 200ms; zero connection pool exhaustion

-   Thundering Herd: 200 offline PWAs x 5 grievances = 1,000 payloads; reconnect simultaneously
-   Pass: all 1,000 payloads sync within 10 min; zero data loss; zero duplicate SLA timers

-   Fail: \>5% payload failure or any SLA timer duplicated → rollback to Sprint 5

**Deliverable: Load test report with P95 latency and Thundering Herd simulation pass evidence**

| **TASK 6.2** | **Security & Privacy Penetration Testing** | *Security Engineer + Privacy Engineer* | **CRITICAL** |
| --- | --- | — | --- |

## UPDATED v4.1 — ALE bypass tests replace SECURITY DEFINER tests; SigNoz/PagerDuty replaces Datadog

-   SQL Injection: all Server Action inputs tested with standard payloads — Zod must reject ALL

-   ALE Bypass Attempts:
-   Patient calls get_phi_for_complaint() with another patient's complaint_id — JWT check must reject

-   Manager calls ALE decrypt for a different department's complaint — Server Action must reject

-   Cross-tenant: Hospital A user queries Hospital B data — JWT mismatch must block at RLS
-   Role Escalation: Quality Coordinator JWT calls Admin Server Action — must throw 403

-   IDOR SAST: semgrep rules block cross-department complaint_id manipulation PRs

-   HIPAA Minimum Necessary: Manager can only decrypt own department PHI; dashboard shows zero PHI without modal; notifications zero PHI

-   **Cryptographic Ledger Tamper Simulation — PASS CRITERIA:**
-   Superuser executes: UPDATE audit_logs SET action_type = 'CONCEALED' WHERE id = \[id\]

-   Synchronous trigger detects broken ledger_hash; INSERTs into security_alerts

-   Supabase Webhook fires to SigNoz / PagerDuty within 500ms

-   PagerDuty incident created — TEST PASS: incident must appear within 60 seconds or Sprint 7 is blocked
-   Deep-Link Abuse: replay used acknowledgment token — must return 'token already consumed' 403

**Deliverable: Signed pen test report; PagerDuty tamper incident screenshot; ALE access control proof**

| **TASK 6.3** | **Disaster Recovery Simulation** | *DevOps Engineer* | **HIGH** |
| --- | --- | — | --- |

## UPDATED v4.1 — WAL-G PITR replaces managed Supabase Pro PITR

-   Validate WAL-G archiving: walg backup-list must show full base backup + continuous WAL stream to ap-south-1

-   DR Simulation Procedure:
-   Step 1: Insert 50 test complaints; note exact timestamps

-   Step 2: Simulate catastrophic corruption on test environment (DROP TABLE audit_logs)

-   Step 3: walg backup-fetch \$PGDATA LATEST followed by WAL replay to target timestamp

-   Step 4: Verify all 50 complaints present; audit_logs chain intact; ledger_hash unbroken post-restore
-   Pass: RPO ≤ 15 minutes; RTO (full system online) \< 1 hour

-   Verify Elasticsearch read-audit logs are independent of DB outage (query DPO logs during outage window)

-   Run walg wal-verify timeline to confirm no WAL gaps in ap-south-1 archive

**Deliverable: DR simulation log with timestamps; WAL-G backup-list screenshot; RPO 15min and RTO 1hr proven**

| **TASK 6.4** | **Observability, APM & SLA Queue Monitoring** | *DevOps Engineer* | **HIGH** |
| --- | --- | — | --- |

## UPDATED v4.1 — SigNoz (OpenTelemetry) replaces Datadog throughout

-   SigNoz full APM: trace all Next.js Server Actions via \@opentelemetry/sdk-node

-   Custom metrics: inngest.queue.depth (alert \> 100), sla.breach.rate (alert \> 5/hr), audit_log.ledger.integrity, ale.decryption.latency (alert P95 \> 50ms)

-   Sentry Developer tier: captures all unhandled Server Action exceptions and Edge Function crashes

-   SigNoz dashboard: real-time SLA queue health, breach count, notification delivery rate, ALE latency

-   Elasticsearch offline log uptime: SigNoz synthetic check every 5 minutes; PagerDuty alert if unreachable

**Deliverable: Live SigNoz dashboard with all custom metrics; PagerDuty alert fire demo on simulated queue overload**

| **TASK 6.5** | **JCI/NABH Mock Surveyor Dry Run** | *Compliance Engineer (as external auditor)* | **CRITICAL** |
| --- | --- | — | --- |

**The Final Sign-Off. All 7 steps must complete in under 10 minutes by a non-developer.**

-   Step 1: Retrieve a specific patient's full complaint lifecycle (submitted → capa_validated → closed)

-   Step 2: Display complaint_status_history — every transition with timestamp and changed_by

-   Step 3: Pull DPDP consent record — consent_version, consented_at, ip_address

-   Step 4: Pull dual-signature CAPA proof — Quality Coordinator sign-off within 30-day window

-   Step 5: Open DPO Investigator — offshore read-audit trail from ap-south-1 Elasticsearch for every staff PHI access

-   Step 6: Display unbroken ledger_hash chain for all audit_log entries related to this complaint

-   Step 7: Generate NABH PRE.7 accreditation report confirming 24h compliance for the month

**Pass: all 7 steps by non-developer in \< 10 minutes with zero navigation errors**

# Fail: any step \> 2 minutes or requiring developer assistance → Sprint 7 blocker

**Deliverable: Surveyor Dry Run Pass Certificate signed by Compliance Engineer**

# Sprint 7 — Buffer, Performance Tuning & Production Release

**2 WEEKS | Full Stack Team | Risk: LOW**

OBJECTIVE: 15-20% timeline buffer to absorb spillovers, optimise frontend performance, remediate Sprint 6 findings, and finalise production deployment.

| **TASK 7.1** | **Architectural Spillover Remediation** | *Database Architect + Backend Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Triage and resolve schema or RLS issues from Sprint 6

-   Address Inngest job queue edge cases from Thundering Herd simulation

-   Resolve Authentik/Keycloak SAML SSO edge cases across enterprise AD configurations

-   Re-run full RLS validation report if any policy changes made during Sprint 6

-   Validate ALE key rotation procedure end-to-end if Sprint 6 surfaced KMS latency issues

| **TASK 7.2** | **Frontend Performance & PWA Optimisation** | *Frontend Architect* | **MEDIUM** |
| --- | --- | — | --- |

-   Next.js bundle analysis: npx \@next/bundle-analyzer — eliminate unnecessary client-side JS

-   Target: Lighthouse PWA score \> 95 for rural connectivity (3G simulation)

-   Framer Motion tree-shaking; Shadcn lazy loading for heavy components; next/image with WebP

-   Service Worker cache strategy review: ensure offline cache does not serve stale auth tokens

**Deliverable: Before/after Lighthouse scores; bundle size reduction evidence**

| **TASK 7.3** | **Security Patch Remediation** | *Security Engineer* | **MEDIUM** |
| --- | --- | — | --- |

-   Remediate all Medium and Low findings from Sprint 6 pen test report

-   Re-run CodeQL and semgrep IDOR scans — must return zero violations

-   npm audit: no HIGH or CRITICAL CVEs in production dependencies

-   HIPAA Minimum Necessary walkthrough on all API response payloads

-   Validate ALE Server Action access control: no response contains plaintext PHI outside authenticated modal

| **TASK 7.4** | **Production Deployment & Documentation** | *DevOps Engineer + Full Stack Team* | **LOW** |
| --- | --- | — | --- |

## UPDATED v4.1 — Self-hosted infra checklist; QR code generation; OTP mock removal

## Production Environment Setup

-   Provision production server(s) in ap-south-1 (Mumbai) — all DPDP data-residency requirements satisfied

-   Deploy self-hosted Supabase Docker Compose on production servers; run all 15 migrations

-   Validate WAL-G archiving to production ap-south-1 S3 — walg backup-list must confirm operational

-   Deploy Authentik/Keycloak IdP on production; import production staff directory from Pre-Task 2.2

-   Configure Inngest production key and activate production webhooks

-   Deploy SigNoz production stack; activate all custom metrics and PagerDuty alert rules

## QR Code Asset Generation (New in v4.1)

-   Generate one hospital-specific QR per facility (/(patient)/intake?hospital_id=\[uuid\])

-   Export as high-resolution PNG and SVG for print (minimum 300 DPI for kit box insert)

-   Validate: each QR scanned on physical device correctly launches Service Worker-cached offline form

-   Deliver QR assets to hospital operations team for next patient welcome kit print run

## Environment & Secrets

-   All secrets via production secrets manager — zero secrets in codebase or plain .env files

-   Production PHI_ENCRYPTION_KEY_ID registered in AWS KMS (ap-south-1); scoped to Antigravity IAM role only

-   OTP mock removed: confirm SMS OTP gateway fully live for production

## Deployment & Documentation

-   Blue-green deployment with staged rollout (5% → 25% → 100% traffic)

-   Clinical Training Documentation:
-   Zero-Training visual guide for Staff Dashboard (SLA management, offline sync, 1-click acknowledge)

-   Quality Coordinator guide (ALE PHI access, MFA re-auth flow, CAPA signing, report export)

-   DPO Investigator guide (forensic query, HIPAA audit report generation)

-   Hospital IT guide (Authentik/Keycloak group management, staff onboarding/offboarding)
-   Final sign-off: Supabase health check, WAL-G backup confirmed, SigNoz green, Inngest healthy, PagerDuty active

**Deliverable: Production live; WAL-G validated; QR codes delivered; all documentation complete; all checks green**

# Master Sprint Summary

| **\#** | **Focus** | **Key Deliverables** | **Risk** | **Owner** |
| --- | --- | — | --- | — |
| **S1** | **DB Foundation & DevSecOps (3wk)** | 14-table schema; ALE BYTEA Migration 008; self-hosted Supabase Docker; WAL-G ap-south-1; RLS; synchronous immutable ledger; SigNoz stubs | **CRITICAL** | DB Architect |
| **S2** | **Auth & Clinical Design System** | Employee ID sync; Authentik/Keycloak SAML SSO; MFA; AES-GCM JWT; Zustand; WCAG AA palette; ALE Server Action pattern | **HIGH** | Security + Frontend |
| **S3** | **Intake, SLA & Workflow Engine** | Dual-Phase PWA; QR Code bridge; DPDP consent; Yjs IndexedDB schema; Inngest SLA; duplicate merge; Wake-Up protocol | **HIGH** | Backend + Frontend |
| **S4** | **Realtime Alerts & Staff Offline UI** | Yjs CRDT staff dashboard; NABH SLA Config UI; WebSocket RLS; TRAI/DLT SMS; 1-click deep-links; ALE PHI modal | **MEDIUM** | Backend + Frontend |
| **S5** | **Analytics & Compliance** | Org-level views; CAPA dual-signature; DPO forensic investigator; B2B widgets; accreditation reports | **MEDIUM** | Compliance + Frontend |
| **S6** | **Chaos Engineering & Surveyor Sign-Off** | Thundering Herd; tamper simulation → PagerDuty; ALE bypass pen testing; WAL-G DR (RPO 15min, RTO 1hr); JCI dry run | **CRITICAL** | QA + DevOps + Privacy |
| **S7** | **Buffer & Production Release** | Sprint 1-6 spillover; Lighthouse \> 95; CVE remediation; QR code generation; blue-green deployment; clinical docs | **LOW** | Full Stack Team |

# Execution Discipline Rules — Antigravity IDE

Non-negotiable constraints enforced by CI/CD pipeline and IDE agents. Any violation reaching main branch is a build-blocking incident.

| **Rule** | **Constraint** |
| --- | --- |
| **Rule 1 — Zero-Trust DB Migrations (UPDATED v4.1)** | No direct DB modifications outside formal SQL migration files. PHI migrations must define AES-256-GCM keys (KMS/Vault) BEFORE Migration 008 runs. PHI columns store BYTEA ciphertext only. pgcrypto retained for ledger hash functions only. Migration files immutable once merged. |
| **Rule 2 — Cryptographic Immutability** | Only soft-deletes (deleted_at) permitted platform-wide. audit_logs and complaint_status_history cannot be altered by any role. ledger_hash chain computed SYNCHRONOUSLY within each write transaction — no batching or async decoupling permitted. Advisory locking handles concurrency. Any disruption triggers build failure and PagerDuty incident. |
| **Rule 3 — Omnipresent RLS & Tenant Boundaries** | Every feature, Server Action, and WebSocket subscription must pass RLS validation. JWT Custom Claims via auth.jwt() are the ONLY permitted RLS isolation mechanism under Supavisor transaction mode. Cross-tenant isolation proven for every new data access path. |
| **Rule 4 — Blind Notifications & Telecom Compliance** | System notifications must contain zero PHI. Only cryptographically signed, single-use secure_link_id deep-links transmitted. All SMS dispatches must use pre-approved TRAI/DLT Template IDs via MSG91 (primary) or Twilio (fallback). |
| **Rule 5 — Offline Resiliency Constraints** | All PWA submissions pass through SHA-256 deduplication hash queue in IndexedDB. Reconnect sync implements exponential backoff with randomised jitter to shield Supavisor from Thundering Herd spikes. |
| **Rule 6 — Strict Session Governance** | 30-minute idle timeout on all clinical dashboard routes via useAuthStore.lastInteractionAt middleware tracking. Patient intake route exempt. JWTs cached offline must use AES-GCM via Web Crypto API — raw Base64 is a build-blocking violation. |
| **Rule 7 — India Data Residency (DPDP Act 2023)** | All PHI read-audit logs routed to ap-south-1 (Mumbai). Media evidence in in-country buckets. WAL-G backup archive also targets ap-south-1. 'Offshore' means off-primary-database AND geographically within India. Read-audits must never be written to PostgreSQL. |
| **Rule 8 — DevSecOps PR Blocking** | semgrep (PHI rules) and CodeQL (IDOR) scan every PR. Any PR exposing raw PHI, calling pgp_sym_encrypt() on complaint_phi, allowing cross-department complaint_id manipulation, or bypassing auth.uid() is automatically blocked and cannot be merged. |
| **Rule 9 — Staff Offline Conflict Resolution** | Staff Dashboard offline PWA must use Yjs CRDTs for ticket state merging. IndexedDB schema finalised in Sprint 3. Automerge explicitly disqualified. |
| **Rule 10 — ALE PHI Access Control (NEW v4.1)** | All decryption of complaint_phi ciphertext occurs exclusively in Next.js Server Actions. No Server Action may return decrypted PHI without a preceding validated JWT department_id claim check. Plaintext PHI must never be logged, cached, or stored outside encrypted DB columns. KMS key access is role-scoped and audited. |
| **Rule 11 — Self-Hosted Infrastructure (NEW v4.1)** | Supabase self-hosted via Docker Compose throughout development and production. WAL-G continuous archiving to ap-south-1 S3 must remain active at all times. No managed Supabase cloud project permitted. All infrastructure must reside in ap-south-1 for DPDP compliance. |

# Multi-Agent Responsibility Matrix

| **Agent** | **Responsibilities** |
| --- | --- |
| **AGENT 1 — Database Architect** | Schema design; all 14 SQL migrations (including ALE BYTEA Migration 008); RLS policies; Supavisor configuration; pg_cron purge jobs; pgcrypto ledger hash triggers (retained); synchronous audit trigger chain; advisory locking for hash concurrency |
| **AGENT 2 — Backend Workflow** | Inngest SLA scheduling and cancellation; escalation engine; Wake-Up protocol; Edge Functions (onComplaintCreated, onSlaBreach, nightlyComplianceAudit); idempotency via processed_events; materialised view refresh triggers; ALE Server Action integration for PHI decryption |
| **AGENT 3 — Security Engineer** | Authentik / Keycloak SAML 2.0 SSO integration; MFA enforcement; AES-GCM JWT caching; ALE Server Action access control pattern implementation; session governance (30-min idle); Zod validation; rate limiting; deep-link single-use token generation; audit_logs security event capture |
| **AGENT 4 — Frontend Architect** | Next.js App Router; clinical design system (HSL palette, dark mode); Zustand store slices; Yjs CRDT integration; offline PWA (Service Workers + IndexedDB); TanStack Table DataTables; DPO Investigator UI; Dynamic SLA Config UI; QR code intake bridge; PHI modal ALE decryption UX |
| **AGENT 5 — Compliance Engineer** | NABH PRE.7 / JCI mapping validation; automated compliance rule engine; dual-signature CAPA workflow; CAPA effectiveness correlation; accreditation report generator (PDF/CSV); JCI mock surveyor dry run orchestration |
| **AGENT 6 — QA / Chaos Engineer** | Thundering Herd simulation (200 PWAs); load testing (1,000 concurrent complaints); SQL injection testing; ALE bypass and RLS bypass attempts; role escalation testing; deep-link replay attack testing; WAL-G DR simulation validation |
| **AGENT 7 — DevOps Engineer** | Self-hosted Supabase Docker Compose setup and maintenance; WAL-G continuous archiving to ap-south-1 S3; CI/CD pipeline (semgrep + CodeQL SAST); SigNoz APM deployment and instrumentation; PagerDuty integration; blue-green production deployment; Elasticsearch uptime monitoring; QR code production asset generation |
| **AGENT 8 — Privacy Engineer** | HIPAA Minimum Necessary audit on all Server Action response payloads; ALE encryption correctness validation (verify no plaintext in DB); PHI validation in materialised views; IDOR CI/CD scanning rules; DPDP consent module validation; offshore log routing verification; ledger tamper simulation execution; KMS key rotation procedure validation |