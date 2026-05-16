# Task 5.3: CAPA Validation Engine & Compliance Rule Engine

**Owner:** Compliance Engineer
**Risk:** MEDIUM

## Objective
Implement dual-signature Corrective and Preventive Action (CAPA) tracking and nightly automated compliance audits.

## Implementation Steps
1. **Dual-Signature CAPA Workflow**:
   - When a complaint status transitions to `capa_validated`, trigger an Inngest job to schedule a 30-day checkpoint.
   - Add UI for the Quality Coordinator to click `Sign & Close CAPA` when validated.
   - Ensure the signature event is logged to the immutable `audit_logs` table.

2. **Nightly Compliance Audits (`nightlyComplianceAudit`)**:
   - Write an edge function or Inngest cron job running nightly.
   - Identify compliance anomalies:
     - 24h acknowledgment breaches.
     - NULL escalations for breached SLAs.
     - Tickets stuck in the `investigating` status beyond thresholds.
     - Missing CAPA signatures post 30 days.

3. **CAPA Effectiveness Overlay**:
   - Integrate `mv_capa_effectiveness` data into the frontend trends graph.
   - Overlay vertical markers on the monthly trend graph indicating when a CAPA intervention occurred to visualize volume changes.

## Deliverable
- CAPA effectiveness chart with intervention overlay; nightly audit digest demo.
