# Multi-Agent Directives

## AGENT 1: Database Architect
* Executes the foundational schema design and implements all 14 SQL migrations.
* Configures Supavisor and establishes Row Level Security (RLS) policies and SECURITY DEFINER functions to ensure strict tenant isolation.
* Implements pgcrypto TDE for encryption, establishes ledger hash triggers, sets up pg_cron purge jobs, and orchestrates the immutable audit trigger chain.

## AGENT 2: Backend Workflow Engineer
* Manages the event-driven Inngest SLA job scheduling and cancellation architecture.
* Builds the escalation engine, the Wake-Up protocol, and vital Edge Functions (onComplaintCreated, onSlaBreach, nightlyComplianceAudit) to drive rapid response times across hospital operations departments.
* Maintains job idempotency using the processed_events table and configures the refresh triggers for materialized views.

## AGENT 3: Security Engineer
* Integrates SAML 2.0 / Entra ID SSO, enforces comprehensive MFA across specific roles, and implements AES-GCM JWT caching.
* Secures the application layer by enforcing a 30-minute idle session timeout, implementing rate limiting middleware, and creating Zod validation schemas.
* Generates single-use deep-link tokens and ensures all security events are comprehensively captured in the audit_logs.

## AGENT 4: Frontend Architect
* Constructs the application layer utilizing the Next.js App Router and a clinical design system built with an HSL palette and dark mode.
* Builds the offline Progressive Web App (PWA) using Service Workers and IndexedDB, ensuring a highly responsive, zero-friction intake experience for hospital in-patients.
* Develops Zustand store slices, integrates Yjs CRDTs for staff offline sync, and builds complex interfaces like the TanStack DataTables, Dynamic SLA Config UI, and DPO Investigator UI.

## AGENT 5: Compliance Engineer
* Validates NABH PRE.7 and JCI mapping alongside the automated compliance rule engine to maintain continuous audit readiness for the quality department.
* Designs the dual-signature CAPA workflow, correlates CAPA effectiveness metrics, and builds the accreditation report generator for PDF and CSV exports.
* Surviving the rigorous scrutiny of 2 JCI audits and numerous NABH audits requires demonstrable compliance; this agent directly orchestrates the final JCI mock surveyor dry run to guarantee platform surveyability.

## AGENT 6: QA / Chaos Engineer
* Executes the Thundering Herd simulation by reconnecting 200 offline PWAs simultaneously, alongside baseline load testing with 1,000 concurrent complaints.
* Conducts aggressive security penetration testing, including SQL injection, RLS bypass attempts, role escalation checks, and deep-link replay attack testing.
* Validates the Disaster Recovery (DR) simulation to guarantee systemic resilience.

## AGENT 7: DevOps Engineer
* Manages the CI/CD pipeline featuring automated semgrep and CodeQL SAST scanning.
* Configures DPDP-compliant structured log streams routed locally to ap-south-1.
* Sets up Supabase PITR, integrates PagerDuty, configures Elasticsearch uptime monitoring, tracks custom SLA metrics via Datadog APM, and oversees the final blue-green production deployment.

## AGENT 8: Privacy Engineer
* Enforces the HIPAA Minimum Necessary rule by auditing all API responses and validating the complete absence of PHI within materialized views.
* Manages the DPDP consent module and maintains the CI/CD scanning rules for IDOR vulnerabilities.
* Verifies offshore data routing and independently executes the pgcrypto ledger tamper simulation to prove cryptographic immutability.
