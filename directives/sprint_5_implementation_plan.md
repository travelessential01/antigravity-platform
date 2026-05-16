# Sprint 5 Implementation Plan

## Goal Description
Implement the Analytics, Compliance & Accreditation Dashboard for ANTIGRAVITY v4.1. This sprint focuses on generating zero-PHI materialised views, rendering B2B marketing widgets, enforcing CAPA (Corporate Corrective and Preventive Action) signatures, providing the DPO with forensic read-audit trails from Elasticsearch, and generating compliance reports for NABH and JCI.

## Proposed Changes

### Database Layer (Task 5.1 & 5.3)
- Execute a new SQL migration to create materialised views (`mv_avg_resolution_time`, `mv_monthly_complaint_trends`, `mv_sla_compliance_percentage`, `mv_department_heatmap`, `mv_capa_effectiveness`, `mv_org_sla_compliance`, `mv_org_complaint_trends`, `mv_org_resolution_benchmarks`).
- Update `audit_logs` triggers to capture CAPA validation signatures.
- Write raw SQL `EXPLAIN ANALYZE` scripts to prove no PHI data is accessed by materialised views.

### Backend/Inngest Layer (Task 5.1 & 5.3)
- Create Inngest event triggers to refresh materialised views concurrently on complaint closure or SLA breach.
- Create an Inngest nightly cron job to run the `nightlyComplianceAudit`.
- Implement Next.js Server Actions for PDF/CSV report generation (Task 5.5 and 5.2).

### Frontend Layer (Task 5.2 & 5.4)
- Create `/(dpo)/investigator` route restricted to `dpo` role.
- Implement server-side pagination to query Elasticsearch `ap-south-1` cluster for read audits.
- Build the SSR Transparency Widget for external embedding.
- Update the Quality Coordinator and Admin dashboards with Bento grid analytics and CAPA effectiveness charts.
- Build UI for Dual-Signature CAPA validation (`Sign & Close CAPA` button).

## Verification Plan

### Automated Tests
1. Verify materialized views contain zero PHI:
   - Run `EXPLAIN ANALYZE SELECT * FROM [mv_name];` and assert `complaint_phi` is not involved in the execution plan.
2. Inngest Cron verification:
   - Trigger the `nightlyComplianceAudit` locally using the Inngest Dev Server UI and verify anomalies are flagged in logs.
3. Access Control (Task 5.4):
   - Using a mock `department_manager` or `quality_coordinator` JWT, attempt to hit the `/(dpo)/investigator` API route and assert a `403 Forbidden` response.

### Manual Verification
1. **CAPA Validation Flow**:
   - Transition a complaint to `capa_validated`. Wait for the 30-day checkpoint trigger (can mock date). Click "Sign & Close" as a Quality Coordinator and verify the signature in `audit_logs`.
2. **DPO Investigator UI**:
   - Log in as a DPO. Open the Investigator UI. Validate infinite scroll works and that no edit/delete buttons exist. Generate a 12-month PDF report and check generation time is <30s.
3. **Report Generator Validation**:
   - Log in as Compliance Engineer. Export the NABH PRE.7 and 24-Hour Compliance reports. Manually inspect the PDF/CSV to ensure no PHI is present and data matches the mock aggregated statistics.
