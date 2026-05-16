# Staff Dashboard — Zero-Training Visual Guide

**Role:** Clinical Staff (Nurse, Ward Attendant, Front Desk)
**Time to complete:** < 5 minutes
**Access:** Staff login → Dashboard

---

## 1 · Logging In

1. Open the app URL or scan the facility QR code.
2. Enter your **Employee ID** and password.
3. Complete the **MFA prompt** (TOTP code from your authenticator app).
4. You land on the **Zero-PHI Quality Dashboard** — no patient names are visible here.

> **Tip:** If you see a "Session expired" banner after 30 minutes of inactivity, log in again. This is intentional per NABH security policy.

---

## 2 · Reading the Dashboard

```
┌─────────────────────────────────────────────────────┐
│  Zero-PHI Quality Dashboard            ● Live        │
├──────────────┬──────────────┬──────────────────────┤
│  Active: 12  │ Critical: 3  │  Resolved Today: 8    │
├──────────────┴──────────────┴──────────────────────┤
│  ID        Severity   Time Left   Location   Status  │
│  CMP-023   CRITICAL   12 min  ↑  ICU Ward 3  Open   │  ← Flashing red row = SLA at risk
│  CMP-019   HIGH       58 min     OPD Block B  Open   │
│  CMP-031   MEDIUM    210 min     Pharmacy     Open   │
└─────────────────────────────────────────────────────┘
```

| Indicator | Meaning |
|---|---|
| 🔴 Pulsing red row | SLA breach imminent — act immediately |
| Time Left < 2h | Critical window — escalate to supervisor if you cannot resolve |
| ● Live (green dot) | Realtime updates active — no need to refresh |

---

## 3 · SLA Management (Acknowledge a Complaint)

### Option A — From the dashboard row

1. Click **"View Details"** on any complaint row.
2. The complaint details panel opens (no PHI visible here).
3. Click **"Acknowledge"** to accept ownership.
4. The row status changes to **Acknowledged** and the SLA timer stops.

### Option B — One-click deep-link (from SMS/notification)

1. You receive an SMS with a secure link.
2. Tap the link → opens directly to the complaint.
3. Tap **"Acknowledge"** once — the link expires after use (15-minute window).

> **Important:** Each deep-link is single-use. Do not forward SMS links to colleagues.

---

## 4 · Offline Sync (No Internet)

The app works offline in areas with poor connectivity.

1. An **"Offline"** banner appears at the top when connectivity is lost.
2. You can still view the last-synced complaints and submit updates.
3. When connectivity is restored, all changes sync automatically — no action needed.
4. The PWA cache stores form data using SHA-256 deduplication, so duplicate submissions are automatically removed.

> **Rural connectivity note:** The app is optimised for 3G connections. Pages load under 3 seconds on 3G.

---

## 5 · Raising a New Complaint (Patient Intake QR)

> This applies to Front Desk / Ward staff helping patients.

1. Ask the patient to scan the **facility QR code** (posted at bedside or reception).
2. The patient's phone opens the **intake form** — they fill it independently.
   *(If patient cannot use a phone, assist them — no login required for intake.)*
3. On submission, you will see the new complaint appear on your dashboard within seconds.

---

## 6 · Common Questions

| Question | Answer |
|---|---|
| I can't see any patient names. Is the system broken? | No — the dashboard shows zero PHI by design. Patient details are encrypted. |
| The SLA timer shows "0 min". What do I do? | Acknowledge immediately and escalate to your supervisor. |
| My session keeps expiring. | Sessions expire after 30 min of inactivity. This is required by NABH policy. |
| I accidentally forwarded a deep-link SMS. | Report to your supervisor immediately. The link expires in 15 min automatically. |

---

*Guide version: v4.1 | Last updated: 2026-03-16 | Antigravity Platform*
