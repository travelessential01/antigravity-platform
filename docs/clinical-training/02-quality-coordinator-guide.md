# Quality Coordinator Guide

**Role:** Quality Coordinator / Nursing Superintendent
**Access:** Staff login → Dashboard + PHI Modal + CAPA Workflow + Report Export
**Prerequisites:** MFA enrolled, `quality_coordinator` role assigned by Hospital IT

---

## 1 · Accessing PHI Details (ALE Decryption)

Patient-identifiable information is encrypted at rest using AES-256-GCM. Only authorised roles can decrypt.

### Steps

1. Log in with your **Employee ID** + MFA.
2. On the dashboard, click **"View Details"** on a complaint.
3. In the complaint panel, click **"Decrypt PHI"**.
4. You will be prompted to **re-authenticate** — enter your MFA code again.
   *(This is the ALE re-auth gate required by NABH and DPDP Act 2023.)*
5. Decrypted patient details appear **only within this modal** for the duration of your session.

> **Security rules:**
> - PHI is never displayed in the complaint list or exported to plain text.
> - Every PHI access is logged to an immutable audit trail (DPDP-compliant).
> - Closing the modal clears the decrypted data from memory.
> - Do not photograph or screenshot the PHI modal.

---

## 2 · MFA Re-Authentication Flow

The platform enforces step-up authentication before displaying sensitive data:

```
Login (password + TOTP)
        ↓
Dashboard (no PHI)
        ↓ click "Decrypt PHI"
MFA Re-auth prompt (TOTP required again)
        ↓ success
PHI Modal (decrypted, in-memory only, auto-cleared on close)
```

If your TOTP app is unavailable, contact Hospital IT to reset MFA — do not share your credentials.

---

## 3 · CAPA Workflow (Corrective and Preventive Action)

CAPA is required for all Critical and High severity complaints once resolved.

### Initiating a CAPA

1. Open a resolved complaint → click **"Initiate CAPA"**.
2. Fill in:
   - **Root Cause** (select category + free text)
   - **Corrective Action** (immediate fix taken)
   - **Preventive Action** (systemic change to prevent recurrence)
   - **Target Completion Date**
3. Click **"Submit for Review"**.

### Dual-Signature Requirement

CAPA requires **two authorised signatures** before closing:

| Signer | Role |
|---|---|
| First | Quality Coordinator (you) |
| Second | Medical Superintendent or DPO |

1. After your submission, the second approver receives a notification.
2. Once both parties sign, the CAPA is sealed in the audit ledger (tamper-proof).
3. A CAPA Completion Certificate is generated automatically.

> **JCI Requirement:** CAPAs must be signed within 48 hours of complaint resolution for JCI PRE.7 compliance.

---

## 4 · Report Export

### NABH PRE.7 Compliance Report (PDF)

1. Navigate to **Settings → Reports**.
2. Select your hospital from the dropdown.
3. Choose **"NABH PRE.7 Report"** and click **"Export PDF"**.
4. The PDF is generated server-side and downloaded immediately.
5. Re-authenticate (MFA required) before the file downloads.

### Annual Grievance Export (CSV)

1. Same path: **Settings → Reports → Annual Grievance Export**.
2. Format: `id, created_at, status, severity, department, sla_deadline, capa_validation_date`
3. No PHI is included in the CSV — this is HIPAA Minimum Necessary compliant.
4. File is named: `annual_grievances_[hospitalId]_[date].csv`

### Quality Coordinator Summary (PDF)

- Includes: SLA compliance %, department heatmap, average resolution time.
- Available at `/api/export-pdf?hospitalId=[your-hospital-id]` (auth required).

---

## 5 · SLA Configuration

> Only Medical Superintendent or Admin can change SLA thresholds. QCs can view.

1. Navigate to **Settings → SLA Configuration**.
2. Current thresholds are displayed (NABH default: Critical 2h, High 4h, Medium 24h).
3. Changes take effect immediately for all new complaints.

---

## 6 · Common Issues

| Issue | Resolution |
|---|---|
| "Decrypt PHI" button is greyed out | Your session may have a stale JWT — log out and back in |
| CAPA second-signer notification not received | Check their spam/SMS; resend from the CAPA detail screen |
| Export PDF returns "No compliance data" | Materialised views may need refresh — contact Hospital IT |
| MFA code rejected | Ensure your device clock is synchronised (NTP). Contact IT if persisting |

---

*Guide version: v4.1 | Last updated: 2026-03-16 | Antigravity Platform*
