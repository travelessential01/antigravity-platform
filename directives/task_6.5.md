# Task 6.5: JCI/NABH Mock Surveyor Dry Run

**Owner:** Compliance Engineer (acting as external auditor)
**Risk:** CRITICAL

## Objective
Validate that a non-developer can complete the full 7-step surveyor audit in under 10 minutes with zero navigation errors. This is the final sign-off gate — any failure blocks Sprint 7.

## The 7-Step Dry Run Protocol

### Step 1: Patient Complaint Lifecycle Retrieval (Target: < 90 sec)
- Navigate to the staff dashboard.
- Search for a specific patient's complaint by Ticket ID.
- Verify the complaint has traversed the full lifecycle: `submitted` → `acknowledged` → `investigating` → `resolved` → `capa_validated` → `closed`.

### Step 2: Complaint Status History (Target: < 60 sec)
- From the complaint detail view, display the `complaint_status_history` timeline.
- Verify every status transition shows: `previous_status`, `new_status`, `changed_by` (staff name), and `timestamp`.
- All transitions must be in chronological order with no gaps.

### Step 3: DPDP/HIPAA Consent Record (Target: < 60 sec)
- Pull the `patient_consents` record for this complaint.
- Verify fields: `consent_version`, `consented_at`, `ip_address`.
- Confirm consent was captured BEFORE any PHI was written to `complaint_phi`.

### Step 4: Dual-Signature CAPA Proof (Target: < 90 sec)
- Locate the CAPA validation entry for this complaint.
- Verify the Quality Coordinator's digital signature entry in `audit_logs`.
- Confirm the signature timestamp falls within the 30-day CAPA checkpoint window.

### Step 5: DPO Offshore Read-Audit Trail (Target: < 90 sec)
- Switch to the DPO Investigator UI (`/(dpo)/investigator`).
- Filter by the staff who accessed this complaint's PHI.
- Verify read-audit trail entries in Elasticsearch (`ap-south-1`) show: `staff_id`, `action_type`, `timestamp`, anonymised `patient_id`.
- Confirm the trail matches exactly who and when PHI was accessed.

### Step 6: Ledger Hash Chain Verification (Target: < 90 sec)
- Display `audit_logs` entries related to this complaint.
- Verify the `ledger_hash` chain is unbroken — each entry's hash = SHA-256(data || previous_hash).
- No hash gaps or mismatches.

### Step 7: NABH PRE.7 Accreditation Report (Target: < 90 sec)
- Navigate to the Accreditation Report Generator.
- Generate the "NABH PRE.7 Summary" report for the current month.
- Verify the report confirms 24-hour acknowledgment compliance for all complaints.
- Download as PDF and spot-check for zero PHI.

## Pass / Fail Criteria

| Criteria | Pass | Fail |
|----------|------|------|
| Total time for all 7 steps | < 10 minutes | ≥ 10 minutes |
| Any individual step | < 2 minutes | ≥ 2 minutes |
| Developer assistance required | None | Any → Sprint 7 blocker |
| Navigation errors | Zero | Any → Sprint 7 blocker |
| Data integrity issues | None | Any → Sprint 7 blocker |

## Pre-Run Setup
- Prepare a "golden" complaint record that has completed the full lifecycle through CAPA closure.
- Pre-seed the Ticket ID for the surveyor-actor to use.
- Ensure the surveyor-actor has the Quality Coordinator role (has access to all steps).
- Open a screen recording tool before starting the timer.

## Deliverable
- Surveyor Dry Run Pass Certificate signed by the Compliance Engineer.
- Screen recording of the complete 7-step dry run.
- Timestamped log showing each step's duration.
