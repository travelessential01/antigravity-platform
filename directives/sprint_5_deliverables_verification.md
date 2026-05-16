# Sprint 5 Deliverables Verification

To confirm Sprint 5 is ready for sign-off, verify the following deliverables:

### 1. Materialised Views (Task 5.1)
- [ ] Verify `EXPLAIN ANALYZE` was executed on all 8 materialised views.
- [ ] Confirm execution plans show NO access to any `BYTEA` column in `complaint_phi`.
- [ ] Verify Inngest queue successfully processes concurrent refreshes on complaint state changes.

### 2. B2B Transparency & Marketing (Task 5.2)
- [ ] Test the SSR Transparency Widget embedding script locally.
- [ ] Generate the 30-day resolution report PDF from the Quality Coordinator dashboard. Review for brand alignment and PHI exclusion.
- [ ] Validate Admin Bento grid drill-down navigation (Org Level -> Hospital Level).

### 3. CAPA & Compliance Engine (Task 5.3)
- [ ] Confirm "Sign & Close CAPA" button writes a verified signature entry into `audit_logs`.
- [ ] Trigger the `nightlyComplianceAudit` and verify it properly identifies staged breaches, stuck tickets, and missing CAPA signatures.
- [ ] Visually verify CAPA overlay lines on the frontend trend graphs.

### 4. DPO Investigator (Task 5.4)
- [ ] Access `/(dpo)/investigator` as DPO and assert successful queries to Elasticsearch (ap-south-1).
- [ ] Attempt to mutate data via DPO dashboard (must fail / UI must be read-only).
- [ ] Generate the 12-month HIPAA Read-Audit Report. Ensure it completes in < 30 seconds.

### 5. Accreditation Reports (Task 5.5)
- [ ] Download all 4 required reports (NABH PRE.7 Summary, 24-Hour Compliance, SLA Breach Summary, Annual Grievance Export) in PDF and CSV.
- [ ] Manually verify reports match system data and contain 0% PHI.
- [ ] Run SAST pipeline locally to confirm report generation scripts pass zero-PHI validation checks.
