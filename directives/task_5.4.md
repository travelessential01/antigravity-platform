# Task 5.4: DPO Forensic Read-Audit Investigator UI

**Owner:** Frontend Architect + Compliance Engineer
**Risk:** MEDIUM

## Objective
Provide the Data Protection Officer (DPO) with a read-only portal querying the offshore Elasticsearch cluster for PHI access audits (DPDP compliance).

## Implementation Steps
1. **Elasticsearch Integration**:
   - Build a Next.js API route connecting to the offshore `ap-south-1` Elasticsearch instance containing `audit_reads`.
   - DO NOT query PostgreSQL for read-audits.

2. **Investigator UI (`/(dpo)/investigator`)**:
   - Create a dashboard with filters: `staff_id`, anonymised `patient_id`, `date_range`, `action_type`.
   - Implement infinite scrolling with server-side pagination.
   - Ensure the UI enforces read-only access—no action buttons or mutations possible.
   - Secure the route to the `dpo` role ONLY.

3. **HIPAA Read-Audit Report Engine**:
   - Add a button to generate a comprehensive HIPAA Read-Audit Report PDF.
   - Ensure the generation completes in < 30 seconds for a 12-month data range.

## Deliverable
- Filter, display timeline, verify read-only enforcement.
