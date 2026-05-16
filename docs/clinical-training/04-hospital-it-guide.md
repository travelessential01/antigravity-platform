# Hospital IT Guide

**Role:** Hospital IT Administrator
**Access:** Admin login → Staff Management + Authentik/Keycloak SSO Console
**Prerequisites:** `admin` role, Authentik/Keycloak admin credentials, network access to IdP

---

## 1 · Architecture Overview

```
Staff Device                Antigravity App              Identity Layer
    │                            │                              │
    ├──── HTTPS ────────────────>│                              │
    │                            │──── SAML 2.0 / OIDC ───────>│ Authentik / Keycloak
    │                            │<─── JWT (custom claims) ────│
    │                            │                              │
    │                    Supabase Auth (RLS)                    │
    │                     + ALE (AES-256-GCM)                   │
    │                     + Audit Ledger (ES)                   │
```

Staff never authenticate directly against the database. All auth flows through the Authentik/Keycloak SAML 2.0 IdP, which issues JWT tokens with custom claims (`role`, `hospital_id`, `department_id`).

---

## 2 · Staff Onboarding

### Step 1 — Create the user in Authentik/Keycloak

1. Log in to the Authentik Admin Console (or Keycloak Admin Console).
2. Navigate to **Users → Create User**.
3. Fill in:
   - `Username` = Employee ID (e.g. `EMP-00123`)
   - `Email` = staff hospital email
   - `First / Last Name`
4. In the **Groups** tab, assign the appropriate group:

| Group | Platform Role |
|---|---|
| `staff` | Clinical staff — dashboard view, acknowledge complaints |
| `quality_coordinator` | Staff + PHI access + CAPA + report export |
| `medical_superintendent` | Quality Coordinator + SLA config + escalation resolve |
| `dpo` | Forensic investigator console, audit ledger |
| `admin` | Full access including user management |

5. Save the user.

### Step 2 — Set initial password

1. In the user profile, click **"Set Password"**.
2. Tick **"Temporary"** — the user will be prompted to change on first login.
3. Share the temporary password securely (not via email).

### Step 3 — Enforce MFA enrollment

1. In the Authentik/Keycloak group policy, ensure **"TOTP MFA required"** is enabled for all groups.
2. On first login, staff are guided through TOTP setup (Google Authenticator, Authy, or any RFC 6238-compatible app).
3. MFA cannot be bypassed — the platform enforces re-auth for all PHI access events.

---

## 3 · Staff Offboarding

1. In Authentik/Keycloak → **Users → [Employee]**.
2. Click **"Disable Account"** (never delete — audit trail must be preserved).
3. Remove the user from all groups immediately.
4. Supabase JWT invalidation is automated — all active sessions expire within 5 minutes.
5. Notify the DPO if the offboarded staff had `dpo` or `quality_coordinator` role (access audit required).

> **Important:** Do not delete user accounts. The DPDP Act and HIPAA require audit log integrity — staff UUIDs must remain valid for audit replay.

---

## 4 · Group Management

### Modifying Group Memberships

1. Authentik Admin → **Groups → [Group Name] → Members**.
2. Add or remove users by Employee ID.
3. Changes take effect on the user's next login (existing JWT expires in 30 min max).

### Custom Claims Mapping

The platform reads these JWT claims from Authentik/Keycloak:

| Claim path | Value example | Purpose |
|---|---|---|
| `app_metadata.role` | `quality_coordinator` | Controls API access, RLS policies |
| `app_metadata.hospital_id` | `2cf24f6f-…` | Scopes data to facility |
| `app_metadata.department_id` | `d1e2f3a4-…` | Scopes complaint access within hospital |

To map group → custom claims in Authentik:

1. Navigate to **Property Mappings → Create SAML/OIDC Mapping**.
2. Add expression:
   ```python
   return {
       "role": request.user.groups.first().name,
       "hospital_id": request.user.attributes.get("hospital_id"),
       "department_id": request.user.attributes.get("department_id")
   }
   ```
3. Assign the mapping to your Authentik Application.

---

## 5 · Session Governance

The platform enforces a 30-minute idle timeout on all clinical dashboard routes.

| Setting | Value | Where configured |
|---|---|---|
| JWT expiry | 30 minutes | Supabase Auth → JWT Expiry |
| Session idle timeout | 30 minutes | Middleware (hardcoded per NABH requirement) |
| MFA re-auth for PHI | Each access | Application-level (cannot be overridden) |
| Deep-link expiry | 15 minutes | Application-level |

> Authentik/Keycloak session lifetime should align with JWT expiry (30 min) for consistency.

---

## 6 · Supabase Docker Maintenance

The platform runs on self-hosted Supabase via Docker Compose.

### Health Check

```powershell
# Verify all core containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "supabase|signoz"
```

Expected output:
```
supabase-db        Up X hours (healthy)
supabase-pooler    Up X hours (healthy)
supabase-rest      Up X hours (healthy)
supabase-auth      Up X hours (healthy)
signoz             running
```

### Running Migrations

```powershell
# Apply a new migration
docker exec supabase-db psql -U postgres -d postgres -f /path/to/migration.sql
```

### WAL-G Backup Verification (Daily Check)

```bash
# SSH into the production server and run:
walg backup-list
```

Expected: at least one backup within the last 24 hours (RPO: 15 minutes, RTO: 1 hour).

---

## 7 · QR Code Management

Each facility has a unique patient intake QR code. When to regenerate:

| Trigger | Action |
|---|---|
| New hospital added to DB | Generate new QR via `/api/qr/generate` |
| Hospital moved to new facility (URL change) | Regenerate all QRs; replace physical prints |
| Hospital ID changes (rare) | Regenerate + destroy all previous prints |

### Generating QRs

1. Log in with `admin` role.
2. Navigate to **`/mock-qr`** (QR Asset Dashboard).
3. Click **"Load Hospitals from DB"**.
4. Download PNG (300 DPI) and SVG for each hospital.
5. Send to the hospital operations team with the label:
   `QR Code — [Hospital Name] — Intake Route — [Date]`

---

## 8 · Common Admin Issues

| Issue | Resolution |
|---|---|
| Staff cannot log in | Check Authentik/Keycloak — user may be disabled or group removed |
| "Access Denied" after role change | New role takes effect after token refresh (max 30 min). Ask staff to log out/in |
| MFA reset request from staff | Authentik → User → Devices → Remove TOTP device; user re-enrolls on next login |
| Supabase containers unhealthy | Run `docker-compose restart supabase-db supabase-auth`; check Docker logs |
| WAL-G backup not found | Check S3 bucket policy and IAM role in ap-south-1; verify `WALG_S3_PREFIX` env var |
| Elasticsearch unreachable | Check SigNoz docker container; verify `ELASTICSEARCH_URL` env var in DPO route |

---

## 9 · Pre-Production Secrets Audit

Before any production deployment, run the secrets audit gate:

```powershell
# Development (informational)
powershell -File "tests\audit-secrets.ps1"

# Production CI gate (exits 1 if any failures)
powershell -File "tests\audit-secrets.ps1" -ProductionMode $true
```

All 9 checks must pass with zero failures before deployment sign-off.

---

*Guide version: v4.1 | Last updated: 2026-03-16 | Antigravity Platform*
