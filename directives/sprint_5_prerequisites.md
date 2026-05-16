# Sprint 5 Prerequisites: Analytics, Compliance & Accreditation Dashboard

Before commencing Sprint 5, ensure the following prerequisites are met:

1. **Sprint 4 Completion Check**:
   - Real-time staff dashboard with SLA breach hoists is functional (Task 4.1 & 4.2).
   - Multi-channel notification engine (SMS, Email) with TRAI/DLT and 1-click deep-linking is operational (Task 4.3).
   - Staff Offline CRDT via Yjs is successfully implemented and tested.

2. **Data Requirements**:
   - `complaints`, `complaint_status_history`, and `sla_breach_log` tables must contain sufficient realistic mock data spanning at least 3 months to effectively test materialised views and analytics.
   - At least 50+ records with varied statuses (`submitted`, `acknowledged`, `investigating`, `resolved`, `capa_validated`, `closed`) to generate meaningful trend graphs.

3. **Infrastructure Readiness**:
   - Self-hosted Supabase (Docker) is running with Supavisor transaction pooling.
   - Inngest is configured and running locally for scheduled jobs (SLA and nightly cron).
   - SigNoz OpenTelemetry APM is running and receiving spans from Next.js Server Actions.
   - Elasticsearch instance in `ap-south-1` (or local equivalent for testing) is deployed and accessible for the DPO read-audit investigator (Task 5.4).

4. **Access Matrix**:
   - Test accounts must exist for `Admin`, `Medical Superintendent`, `Quality Coordinator`, and `DPO` roles with proper JWT claims mapped via Authentik/Keycloak.

5. **Security Tooling**:
   - SAST (semgrep) and IDOR (CodeQL) rules from previous sprints must be active in the CI/CD pipeline to automatically validate zero-PHI enforcement on new materialised views.
