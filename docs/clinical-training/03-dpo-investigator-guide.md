# DPO Investigator Guide

**Role:** Data Protection Officer (DPO)
**Access:** DPO login → Forensic Investigator Console
**Prerequisites:** MFA enrolled, `dpo` role assigned, AWS KMS access configured

---

## 1 · Overview of the DPO Console

The DPO Investigator console provides access to the **offshore read-audit ledger** stored in Elasticsearch (ap-south-1). This is legally separate from the primary Supabase database in accordance with the DPDP Act 2023 and HIPAA requirements.

```
Primary DB (Supabase, ap-south-1)     Audit Ledger (Elasticsearch, ap-south-1)
 - Complaint records (encrypted)        - PHI read events
 - CAPA records                         - Staff access timestamps
 - Notifications                        - IP addresses
                    ↑                              ↑
               Application               DPO Investigator Console
```

> **Data residency:** All audit reads are logged exclusively to ap-south-1 (Mumbai). No data is offshore outside India's jurisdiction.

---

## 2 · Accessing the Forensic Investigator Console

1. Log in with your **DPO credentials** + MFA.
2. Navigate to **Investigator → Forensic Query**.
3. You are now connected to the live audit ledger.

> **Authentication note:** All DPO API endpoints enforce JWT role verification. Your token must contain `role: dpo`. If you see "Access Denied: DPO clearance required", contact Hospital IT.

---

## 3 · Running a Forensic Query

### Query Parameters

| Parameter | Description | Example |
|---|---|---|
| `staffId` | Filter by staff member UUID | `a1b2c3d4-…` |
| `patientId` | Filter by hashed patient identifier (DPDP-compliant) | SHA-256 hash |
| `actionType` | Filter by action type | `phi_read`, `phi_decrypt` |
| `fromDate` / `toDate` | Date range filter (ISO 8601) | `2026-01-01T00:00:00Z` |
| `page` / `limit` | Pagination (default: 50 per page) | `page=1&limit=50` |

### Step-by-Step

1. In the Forensic Query panel, enter your filter criteria.
2. Click **"Run Query"**.
3. Results show: `TIMESTAMP | ACTION | STAFF ID | IP ADDRESS`.
4. No plaintext patient names are displayed — only hashed `patient_id_hash` values (DPDP Minimum Necessary).
5. Use **"Next Page"** to paginate through large result sets (max 500 records per export).

---

## 4 · Generating a HIPAA/DPDP Forensic Audit Report (PDF)

1. In the Forensic Query panel, set your query parameters.
2. Click **"Export Forensic Report (PDF)"**.
3. Re-authenticate with MFA (step-up auth required for export).
4. The server queries the audit ledger and generates a PDF containing:
   - Report header: generation timestamp, ap-south-1 data residency confirmation
   - Query parameters applied
   - Tabular results: Timestamp, Action, Staff ID, IP Address
5. File downloads as: `hipaa_dpdp_forensic_audit_[date].pdf`

> **Legal hold:** Keep forensic reports for a minimum of 7 years per HIPAA requirement and 5 years per DPDP Act 2023.

---

## 5 · Reading the Audit Ledger

### Understanding Audit Fields

| Field | Description |
|---|---|
| `timestamp` | UTC timestamp of the event |
| `action` | Action taken (`phi_read`, `phi_decrypt`, `complaint_view`, `export`) |
| `staff_id` | UUID of the staff member who performed the action |
| `metadata.patient_id_hash` | SHA-256 hash of patient identifier — never plaintext |
| `metadata.ip_address` | IP address of the requesting client |
| `metadata.hospital_id` | Hospital context of the access |

### Verifying Audit Ledger Integrity

The audit log uses an immutable `ledger_hash` chain (computed synchronously on every write). To verify:

1. Navigate to **Investigator → Ledger Integrity Check**.
2. The system replays all hashes and confirms the chain is unbroken.
3. Any tampering attempt triggers a **PagerDuty incident** automatically.

---

## 6 · Handling a Data Breach Incident

If the Forensic Query reveals unauthorised PHI access:

| Step | Action |
|---|---|
| 1 | Export the complete forensic report for the affected date range |
| 2 | Note staff IDs involved — report to CISO |
| 3 | Navigate to **Security → Alerts** to check if a PagerDuty alert was already raised |
| 4 | File a DPDP breach notification with the Data Protection Board of India within 72 hours |
| 5 | Initiate a CAPA for systemic remediation |

---

## 7 · Key Compliance References

| Standard | Requirement | How it is met |
|---|---|---|
| DPDP Act 2023 §9 | Data minimisation | Only hashed patient IDs in audit logs |
| DPDP Act 2023 §12 | Data localisation | Elasticsearch cluster in ap-south-1 |
| HIPAA §164.312(b) | Audit controls | Immutable ledger_hash chain |
| HIPAA §164.308(a)(1) | Risk management | PagerDuty tamper alerts |
| NABH PRE.7 | Grievance audit trail | 90-day local audit purge + 7-year Elasticsearch retention |

---

## 8 · Common Issues

| Issue | Resolution |
|---|---|
| Query returns no results | Elasticsearch may be rebuilding index — retry in 5 minutes |
| "Access Denied: DPO clearance required" | JWT role is not `dpo` — contact Hospital IT to verify role assignment |
| PDF export hangs | Export limit is 500 records — narrow your date range and retry |
| `patient_id_hash` in results is `null` | Legacy records before v4.0 may lack hashed IDs — note in report |

---

*Guide version: v4.1 | Last updated: 2026-03-16 | Antigravity Platform*
