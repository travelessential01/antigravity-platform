# Task 5.1: Materialised Views — PHI-Stripped Analytics

**Owner:** Compliance Engineer + Database Architect
**Risk:** MEDIUM

## Objective
Create SQL materialised views to aggregate hospital and organisation-level analytics without exposing any PHI. Set up Inngest triggers/crons for concurrent refreshes.

## Implementation Steps
1. **Hospital-Level Views (`hospital_id` scoped)**:
   - `mv_avg_resolution_time`: Calculate average time from `submitted` to `resolved`.
   - `mv_monthly_complaint_trends`: Group complaints by month and category.
   - `mv_sla_compliance_percentage`: Calculate percentage of complaints resolved within SLA.
   - `mv_department_heatmap`: Aggregate complaint volume by department.
   - `mv_capa_effectiveness`: Compare complaint volumes 30 days pre vs 30 days post-CAPA.

2. **Organisation-Level Views**:
   - `mv_org_sla_compliance`, `mv_org_complaint_trends`, `mv_org_resolution_benchmarks`.
   - Apply strict RLS or restrict access to `Admin` and `Medical Superintendent` roles only.

3. **Refresh Mechanism**:
   - Create an Inngest event triggered on complaint `closed` or `sla_breach_log` INSERT to `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
   - Implement a nightly Inngest cron job at 02:30 IST to catch any missed updates.

4. **Security Validation**:
   - Ensure none of the materialised views query or return `patient_id`, `description`, `reporter_name`, or `reporter_contact` from `complaint_phi`.

## Deliverable
- `EXPLAIN ANALYZE` proof showing zero PHI columns in the result set.
