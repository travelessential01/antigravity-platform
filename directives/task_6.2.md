# Task 6.2: Security & Privacy Penetration Testing

**Owner:** Security Engineer + Privacy Engineer
**Risk:** CRITICAL

## Objective
Perform adversarial security testing across all attack vectors — SQL injection, ALE bypass, cross-tenant leakage, role escalation, deep-link replay, IDOR, and cryptographic ledger tamper detection — to validate the platform is attack-resistant before Sprint 7 production cutover.

## Implementation Steps

### 1. SQL Injection Testing
- **Script**: `tests/security/sql_injection_tests.ps1`
- Test all Server Action endpoints with standard SQL injection payloads:
  - `' OR 1=1 --`, `'; DROP TABLE complaints; --`, `UNION SELECT`, etc.
- **Pass**: Zod validation rejects ALL payloads before reaching the database layer.
- Log every rejection to `audit_logs` with `action_type = 'injection_attempt'`.

### 2. ALE Bypass Attempts
- **Test 2a — Patient Cross-Access**:
  - Patient A authenticates and calls `get_phi_for_complaint()` with Patient B's `complaint_id`.
  - **Pass**: Server Action rejects with 403; JWT `patient_id` mismatch logged to `audit_logs`.
- **Test 2b — Manager Cross-Department**:
  - Department Manager (Dept 1) calls ALE decrypt for a complaint belonging to Dept 2.
  - **Pass**: Server Action validates JWT `department_id` claim against `complaints.department_id` and rejects.
- **Test 2c — Cross-Tenant Hospital Isolation**:
  - Hospital A user queries Hospital B data with manipulated JWT.
  - **Pass**: RLS blocks at PostgreSQL layer; zero rows returned.

### 3. Role Escalation Testing
- Quality Coordinator JWT calls Admin-only Server Actions (e.g., `updateSlaConfiguration`, user management).
- **Pass**: All Admin Server Actions reject with 403 for non-Admin roles.
- Test patient role attempting to access `/(staff)/dashboard` and `/(admin)/settings` routes.
- **Pass**: Middleware redirects or returns 403.

### 4. IDOR SAST Verification
- Run `semgrep` with custom IDOR rules across all Server Actions.
- Verify no Server Action allows `complaint_id` or `patient_id` parameter manipulation without JWT validation.
- **Pass**: Zero semgrep findings on IDOR rules.

### 5. HIPAA Minimum Necessary Validation
- Verify Manager dashboard shows zero PHI without explicit modal interaction.
- Verify notification payloads (SMS/email/in-app) contain zero PHI — only `secure_link_id`.
- Verify PHI modal requires MFA re-confirmation before ALE decryption.
- **Pass**: No PHI visible in browser network tab without modal interaction.

### 6. Cryptographic Ledger Tamper Simulation
- **Procedure**:
  1. Using `service_role` key, execute: `UPDATE audit_logs SET action_type = 'CONCEALED' WHERE id = [target_id]`.
  2. Synchronous trigger must detect broken `ledger_hash`.
  3. Trigger INSERTs into `security_alerts`.
  4. Supabase Webhook fires to SigNoz within 500ms.
  5. PagerDuty incident created from SigNoz alert.
- **Pass**: PagerDuty incident appears within 60 seconds of tamper attempt.
- **Fail**: Incident not received within 60 seconds → Sprint 7 is BLOCKED.

### 7. Deep-Link Replay Abuse
- Use a previously consumed acknowledgment token to replay the `/api/acknowledge` endpoint.
- **Pass**: Server returns 403 with `token already consumed` error.
- Rate limit: attempt 6 rapid requests — 6th must be rate-limited (5 req/min cap).

## Deliverable
- Signed penetration test report documenting all test results.
- PagerDuty tamper incident screenshot with timestamp.
- ALE access control proof for all bypass tests.
- semgrep IDOR scan output showing zero violations.
