# Surveyor Dry Run Checklist — Task 6.5

**Performer:** Non-developer team member (acting as JCI/NABH Surveyor)
**Role Required:** Quality Coordinator (has access to all 7 steps)
**Time Limit:** 10 minutes total, < 2 minutes per step

---

## Before You Begin

1. **Start screen recording** (OBS Studio, Windows Game Bar, etc.)
2. **Open a stopwatch** — you will note the time at each step boundary.
3. **Log in** as: `priya.sharma977@apollohospital.local` (Quality Coordinator)
4. **Golden Complaint ID:** `30b6403b-0543-5a3c-a9a5-fa78458138ba`

---

## Step 1: Patient Complaint Lifecycle ⏱️ < 90 sec
- [ ] Navigate to the Staff Dashboard
- [ ] Search for Ticket ID: `30b6403b-0543-5a3c-a9a5-fa78458138ba`
- [ ] Verify status shows: **closed**
- [ ] Note timestamp: ______

## Step 2: Complaint Status History ⏱️ < 60 sec
- [ ] Open the complaint detail / history view
- [ ] Verify 6 transitions visible:
  - `submitted` → `acknowledged` → `investigating` → `resolved` → `capa_validated` → `closed`
- [ ] Each transition shows: previous_status, new_status, changed_by, timestamp
- [ ] Note timestamp: ______

## Step 3: DPDP/HIPAA Consent Record ⏱️ < 60 sec
- [ ] View the consent record for this complaint
- [ ] Verify: `consent_version` = `v2.1-DPDP-2023`
- [ ] Verify: `consented_at` timestamp is BEFORE complaint `created_at`
- [ ] Verify: `ip_address` = `192.168.1.100`
- [ ] Note timestamp: ______

## Step 4: Dual-Signature CAPA Proof ⏱️ < 90 sec
- [ ] Locate the CAPA validation entry in audit logs
- [ ] Verify `action_type` = `CAPA_SIGN_CLOSE`
- [ ] Verify `actor_id` maps to Quality Coordinator (Priya Sharma)
- [ ] Verify signature timestamp is within 30 days of `capa_validated` transition
- [ ] Note timestamp: ______

## Step 5: DPO Offshore Read-Audit Trail ⏱️ < 90 sec
- [ ] Navigate to `/(dpo)/investigator`
- [ ] Filter by staff who accessed this complaint's PHI
- [ ] Verify Elasticsearch results show: staff_id, action_type, timestamp, anonymised patient_id
- [ ] Verify data comes from `ap-south-1` (check API source)
- [ ] Note timestamp: ______

## Step 6: Ledger Hash Chain Verification ⏱️ < 90 sec
- [ ] View audit_logs for complaint `30b6403b-0543-5a3c-a9a5-fa78458138ba`
- [ ] Verify `ledger_hash` column is populated for every entry
- [ ] Verify hash chain: each `ledger_hash` = SHA-256(data || previous_hash)
- [ ] No gaps or NULL hashes in the chain
- [ ] Note timestamp: ______

## Step 7: NABH PRE.7 Report Generation ⏱️ < 90 sec
- [ ] Navigate to Accreditation Report Generator
- [ ] Select "NABH PRE.7 Summary" for current month
- [ ] Click Generate → Download PDF
- [ ] Open PDF: verify 24-hour compliance data present
- [ ] Spot-check: zero PHI in the PDF
- [ ] Note timestamp: ______

---

## Post-Run

| Step | Start Time | End Time | Duration | Pass? |
|------|-----------|----------|----------|-------|
| 1    |           |          |          |       |
| 2    |           |          |          |       |
| 3    |           |          |          |       |
| 4    |           |          |          |       |
| 5    |           |          |          |       |
| 6    |           |          |          |       |
| 7    |           |          |          |       |
| **Total** | | | **< 10 min?** | |

**Surveyor Dry Run Result:** ☐ PASS  ☐ FAIL

**Signed by:** _________________________ (Compliance Engineer)
**Date:** _________________________
