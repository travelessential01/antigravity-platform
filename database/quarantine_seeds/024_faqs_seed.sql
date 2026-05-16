-- ============================================================================
-- FAQ Seed Data — Comprehensive Admin Knowledge Base
-- Covers: Initial Setup, Admin Operations, Employee/Department Management,
--         Walkthroughs, Debugging, Troubleshooting
-- ============================================================================

INSERT INTO public.faqs (category, question, answer, sort_order, is_published, target_audience, tags) VALUES

-- ═══════════════════════════════════════════════════════════════════════════
-- INITIAL SETUP
-- ═══════════════════════════════════════════════════════════════════════════

('Initial Setup',
 'How do I set up the platform for the first time?',
 'Follow these steps to complete the initial platform setup:

1. **Environment Configuration**: Copy `.env.example` to `.env` and fill in the required values — Supabase URL, anon key, and service role key.
2. **Database Migration**: Run all SQL migrations in the `database/migrations/` folder in numerical order (001 through 024) against your Supabase instance.
3. **Seed Data**: Execute `seed.sql` to create the demo organization, hospital, departments, and users.
4. **Authentik SSO** (optional): Import the SAML metadata XML into Authentik and configure the provider/application.
5. **Start the Dev Server**: Run `pnpm install` followed by `pnpm dev`. The app will be available at `http://localhost:3000`.
6. **First Login**: Navigate to `/login` and sign in with the default admin credentials from the seed data.',
 1, true, 'staff', ARRAY['setup', 'installation', 'getting-started']),

('Initial Setup',
 'What environment variables are required?',
 'The following environment variables must be set in your `.env` file:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous/public key from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key (server-side only, never expose to client) |
| `NEXT_PUBLIC_SITE_URL` | The base URL of your application |

**Optional variables:**
- `SENTRY_DSN` — For error tracking via Sentry
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OpenTelemetry collector endpoint for observability
- `REDIS_URL` — Redis connection string for rate limiting',
 2, true, 'staff', ARRAY['env', 'configuration', 'environment']),

('Initial Setup',
 'How do I run the database migrations?',
 'Database migrations are located in `database/migrations/` and should be executed sequentially:

1. Open the Supabase SQL editor (or use `psql` for self-hosted instances).
2. Run each migration file in order: `001_organizations.sql`, `002_hospitals.sql`, etc.
3. After all schema migrations, apply the unified bootstrap seed: `psql $DATABASE_URL -f database/seeds/bootstrap.sql`

**Important**: Migrations are idempotent — they use `IF NOT EXISTS` clauses, so re-running them is safe. The bootstrap seed uses `ON CONFLICT DO NOTHING` so it is also safe to re-run.',
 3, true, 'staff', ARRAY['database', 'migration', 'sql', 'supabase']),

('Initial Setup',
 'How do I configure SSO with Authentik?',
 'To set up SAML-based SSO with Authentik:

1. **Create a Provider** in Authentik: Go to Applications → Providers → Create → SAML Provider. Set the ACS URL to `{SUPABASE_URL}/auth/v1/sso/saml/acs` and Entity ID to `{SUPABASE_URL}/auth/v1/sso/saml/metadata`.
2. **Create an Application**: Link it to the SAML provider you just created.
3. **Download Metadata**: Export the metadata XML from Authentik.
4. **Register in Supabase**: Use the Supabase Admin API or SQL to register the SSO provider with the metadata XML.
5. **Test**: Navigate to `/login` and click "Sign in with SSO". You should be redirected to Authentik.

**Troubleshooting**: If you get a 504 timeout, ensure the Authentik container is reachable from the Supabase auth container. Check Docker networking.',
 4, true, 'staff', ARRAY['sso', 'authentik', 'saml', 'authentication']),

('Initial Setup',
 'How do I access the admin panel after setup?',
 'After provisioning your account via Authentik SSO, navigate to `/login` and authenticate via SSO. You will be redirected to your role-based dashboard automatically. Admins land on the Organisation Intelligence dashboard.

**Security Note**: All staff accounts must be provisioned via Authentik — there are no default shared credentials. Contact your IT administrator to have your account created and the correct role assigned.',
 5, true, 'staff', ARRAY['login', 'admin', 'access']),

-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN PANEL OPERATIONS
-- ═══════════════════════════════════════════════════════════════════════════

('Admin Panel Operations',
 'How do I access the Organization Dashboard?',
 'Navigate to `/org-dashboard` after logging in with an Admin role account. The dashboard displays:

- **Global SLA Compliance** — Aggregated compliance percentage across all hospitals
- **SLA Breach Count** — Number of cross-organization breaches
- **Intake Volume** — Total grievances received (month-to-date)
- **Resolution Timeline** — Average resolution time in hours
- **CAPA Effectiveness** — Before/after comparison of corrective actions
- **Hospital Drill-Down** — Per-facility cards with NABH/JCI accreditation status and QC report downloads

The dashboard is server-side rendered and uses PHI-stripped materialized views for compliance.',
 1, true, 'staff', ARRAY['dashboard', 'org', 'analytics', 'compliance']),

('Admin Panel Operations',
 'How do I configure SLA thresholds?',
 'SLA (Service Level Agreement) thresholds control the acknowledgement and resolution time limits:

1. Go to **Settings → SLA Configuration** (`/settings/sla-config`).
2. Adjust the **Acknowledgement Threshold** (default: 24 hours per NABH PRE.7).
3. Adjust the **Resolution Threshold** (default: 30 days for standard, 7 days for critical severity).
4. Save changes.

SLA breaches are automatically detected by the system and logged in the `sla_breach_log` table. Breach events trigger escalation notifications via the Inngest workflow engine.

**Note**: Changing thresholds does not retroactively affect existing complaints.',
 2, true, 'staff', ARRAY['sla', 'configuration', 'thresholds', 'nabh']),

('Admin Panel Operations',
 'How do I export compliance reports?',
 'Compliance reports can be exported in two ways:

**PDF Export:**
1. From the Organization Dashboard, locate the hospital card.
2. Click **"Download QC Report"** — this generates a PDF via the `/api/export-pdf` endpoint.
3. The PDF includes SLA metrics, breach counts, trending data, and CAPA summaries.

**CSV Export:**
1. Navigate to the staff dashboard data table.
2. Use the built-in export functionality to download complaint data as CSV.

All exports are PHI-stripped and audit-logged. The audit trail records who exported what and when, stored in the `audit_logs` table.',
 3, true, 'staff', ARRAY['export', 'pdf', 'csv', 'compliance', 'report']),

('Admin Panel Operations',
 'How does the real-time notification system work?',
 'The platform uses Supabase Realtime Subscriptions for live updates:

- **New Complaints**: Staff see incoming complaints in real-time without page refresh.
- **Status Changes**: When a complaint is acknowledged or resolved, all connected users see the update.
- **SLA Breach Alerts**: Triggered when thresholds are exceeded, visible to admins and relevant department heads.

The subscription logic is in `src/lib/realtime-subscriptions.ts`. Channels are scoped by `hospital_id` for data isolation.

**Note**: If real-time updates stop working, check the Supabase Realtime service status and ensure WebSocket connections are not blocked by your network/proxy.',
 4, true, 'staff', ARRAY['realtime', 'notifications', 'websocket', 'supabase']),

('Admin Panel Operations',
 'How do I manage the FAQ Knowledge Base?',
 'The FAQ system is accessible at `/faq-management`:

1. **Create**: Click "Create FAQ" → fill in question, answer, category, audience, tags, and sort order.
2. **Edit**: Hover over any FAQ → click the pencil icon to modify.
3. **Publish/Unpublish**: Toggle visibility with the eye icon. Only published FAQs are visible to patients.
4. **Delete**: Click the trash icon → confirm deletion.
5. **Search**: Use the search bar to filter by question text, answer content, or tags.
6. **Filter**: Narrow results by category, target audience, or publish status.
7. **View Modes**: Toggle between List (accordion) and Grid (cards) views.

FAQs support custom categories beyond the presets, and each FAQ can target Patients, Staff, or Everyone.',
 5, true, 'all', ARRAY['faq', 'knowledge-base', 'content-management']),

-- ═══════════════════════════════════════════════════════════════════════════
-- EMPLOYEE & DEPARTMENT MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════

('Employee & Department Management',
 'How do I create a new department?',
 'Departments are created via direct database insertion (admin UI planned for future sprint):

```sql
INSERT INTO departments (hospital_id, name, head_email)
VALUES (
  ''your-hospital-uuid'',
  ''Cardiology'',
  ''head.cardiology@hospital.local''
);
```

Each department must be linked to a valid `hospital_id`. The `head_email` should correspond to a registered user who will receive escalation notifications for that department.

**Via Supabase Dashboard:**
1. Open the Supabase Table Editor → `departments` table.
2. Click "Insert Row" and fill in the fields.
3. Save.

Departments appear in complaint routing dropdowns once created.',
 1, true, 'staff', ARRAY['department', 'create', 'hospital', 'setup']),

('Employee & Department Management',
 'How do I provision a new staff member?',
 'Staff provisioning involves two steps — Supabase auth user creation and role assignment:

**Step 1: Create the Auth User**
Via the Supabase Dashboard → Authentication → Users → "Add User", or via API:
```bash
curl -X POST ''{SUPABASE_URL}/auth/v1/admin/users'' \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d ''{"email": "staff@hospital.local", "password": "SecurePass123!", "email_confirm": true}''
```

**Step 2: Assign Role & Hospital**
```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  ''{app_role}'',
  ''"Quality Coordinator"''
)
WHERE email = ''staff@hospital.local'';
```

**Step 3: Create User Profile**
```sql
INSERT INTO users (id, hospital_id, email, full_name, role)
VALUES (
  ''auth-user-uuid'',
  ''hospital-uuid'',
  ''staff@hospital.local'',
  ''Dr. Jane Smith'',
  ''Quality Coordinator''
);
```

Available roles: `Admin`, `Quality Coordinator`, `Medical Superintendent`, `Department Manager`, `Staff`.',
 2, true, 'staff', ARRAY['user', 'staff', 'provisioning', 'create', 'role']),

('Employee & Department Management',
 'What roles are available and what can each do?',
 'The system supports these roles with increasing privilege levels:

| Role | Capabilities |
|------|-------------|
| **Staff** | View assigned complaints, update status, add notes |
| **Department Manager** | All Staff permissions + view department-level analytics |
| **Quality Coordinator** | All Manager permissions + SLA configuration, compliance reports |
| **Medical Superintendent** | All QC permissions + organization-wide oversight |
| **Admin** | Full system access including user management, settings, FAQ management |

**MFA Requirement**: Admin, Quality Coordinator, Medical Superintendent, and Department Manager roles require Multi-Factor Authentication (AAL2). The middleware automatically redirects to MFA enrollment/challenge if not completed.

Roles are stored in `auth.users.raw_app_meta_data.app_role` and enforced by Row Level Security policies.',
 3, true, 'staff', ARRAY['roles', 'permissions', 'rbac', 'mfa', 'security']),

('Employee & Department Management',
 'How do I set up on-call schedules for departments?',
 'On-call schedules determine which staff member receives escalation notifications:

```sql
INSERT INTO on_call_schedules (department_id, user_id, start_time, end_time, day_of_week)
VALUES (
  ''department-uuid'',
  ''user-uuid'',
  ''08:00:00'',
  ''20:00:00'',
  1  -- Monday (1=Mon, 7=Sun)
);
```

When an SLA breach occurs, the system checks the `on_call_schedules` table to identify the responsible staff member for the relevant department and time slot.

**Best Practice**: Ensure complete coverage — every department should have on-call assignments for all 7 days to avoid missed escalations.',
 4, true, 'staff', ARRAY['on-call', 'schedule', 'escalation', 'department']),

('Employee & Department Management',
 'How do I deactivate a staff account?',
 'To deactivate a staff member without deleting their data:

**Option 1: Disable Auth Login**
Via Supabase Dashboard → Authentication → Users → find the user → click "Ban User". This prevents login while preserving all audit trails and complaint history.

**Option 2: Via API**
```bash
curl -X PUT ''{SUPABASE_URL}/auth/v1/admin/users/{USER_ID}'' \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d ''{"ban_duration": "876000h"}''
```

**Important**: Never delete auth users directly — this breaks foreign key references in `audit_logs`, `complaints`, and `complaint_status_history`. Always use the ban/disable approach.',
 5, true, 'staff', ARRAY['deactivate', 'disable', 'user', 'ban', 'offboarding']),

-- ═══════════════════════════════════════════════════════════════════════════
-- WALKTHROUGHS
-- ═══════════════════════════════════════════════════════════════════════════

('Walkthroughs',
 'Walkthrough: Processing a patient complaint end-to-end',
 '**Complete lifecycle of a grievance from intake to resolution:**

1. **Patient Submits Complaint**
   Patient scans the hospital QR code → lands on the intake form → fills in complaint details → submits. The form creates records in both `complaints` (non-PHI metadata) and `complaint_phi` (encrypted patient details).

2. **Acknowledgement**
   Staff sees the new complaint in real-time on the dashboard. They click to acknowledge → system records timestamp. The SLA acknowledgement clock stops.

3. **Investigation & Assignment**
   Staff routes the complaint to the appropriate department. The department head is notified via the escalation system.

4. **Resolution**
   The assigned staff member investigates, takes corrective action, and marks the complaint as resolved. Resolution notes are added.

5. **SLA Monitoring**
   Throughout the process, the system monitors SLA thresholds. If acknowledgement exceeds 24h or resolution exceeds the configured limit, an SLA breach is logged and escalation triggers.

6. **Reporting**
   Admins view aggregated metrics on the Organization Dashboard. CAPA effectiveness is tracked via before/after volume comparisons.',
 1, true, 'all', ARRAY['walkthrough', 'complaint', 'lifecycle', 'process']),

('Walkthroughs',
 'Walkthrough: Setting up a new hospital facility',
 '**Steps to onboard a new hospital into the platform:**

1. **Create the Hospital Record**
```sql
INSERT INTO hospitals (organization_id, name, nabh_accredited, jci_accredited)
VALUES (
  ''org-uuid'',
  ''City General Hospital'',
  true,
  false
);
```

2. **Create Departments** — Add at least the core departments (see Department Creation FAQ).

3. **Generate QR Codes** — Navigate to `/mock-qr?hospitalId={NEW_HOSPITAL_ID}` to generate the patient intake QR code.

4. **Provision Staff** — Create auth users and assign them to the new hospital (see Staff Provisioning FAQ).

5. **Configure SLAs** — Set acknowledgement and resolution thresholds specific to this facility.

6. **Set On-Call Schedules** — Assign staff to on-call rotations for each department.

7. **Verify** — Submit a test complaint via the QR code and verify it appears on the staff dashboard.',
 2, true, 'staff', ARRAY['walkthrough', 'hospital', 'onboarding', 'setup']),

('Walkthroughs',
 'Walkthrough: Configuring MFA for privileged roles',
 '**Multi-Factor Authentication is mandatory for Admin, Quality Coordinator, Medical Superintendent, and Department Manager roles.**

**How it works:**

1. User logs in with email/password → arrives at AAL1 (single factor).
2. Middleware checks `app_metadata.app_role` — if it requires MFA, it redirects to `/auth/mfa/enroll` (first time) or `/auth/mfa/challenge` (subsequent logins).
3. **Enrollment**: User scans a TOTP QR code with an authenticator app (Google Authenticator, Authy, etc.) and enters the verification code.
4. **Challenge**: On subsequent logins, user enters the 6-digit TOTP code from their app.
5. Upon successful verification, the user is elevated to AAL2 and redirected to the dashboard.

**Admin Override**: If a user loses their authenticator, an admin can unenroll their MFA factors via the Supabase Dashboard → Authentication → Users → select user → MFA tab → delete factors.',
 3, true, 'staff', ARRAY['walkthrough', 'mfa', 'totp', 'security', '2fa']),

('Walkthroughs',
 'Walkthrough: Understanding the audit trail system',
 '**Every sensitive operation is immutably logged for NABH/JCI compliance.**

**What gets logged:**
- PHI access (viewing patient details in the detail modal)
- Complaint status changes (acknowledged, resolved, escalated)
- SLA breach events
- User login/logout events
- Data exports (PDF/CSV)
- Configuration changes (SLA thresholds)

**Where it''s stored:**
- `audit_logs` table — tamper-proof with immutable triggers (cannot be updated or deleted)
- Each entry includes: `action`, `table_name`, `record_id`, `old_data`, `new_data`, `performed_by`, `ip_address`, `timestamp`

**Viewing Audit Logs:**
- Admins can query the `audit_logs` table directly via the Supabase Dashboard.
- The PHI Detail Modal automatically logs access when a staff member views patient information.

**Compliance**: The immutable audit trigger (`018_immutable_audit_triggers.sql`) prevents any modification or deletion of audit records, ensuring chain-of-custody integrity.',
 4, true, 'staff', ARRAY['walkthrough', 'audit', 'compliance', 'logging', 'nabh', 'jci']),

-- ═══════════════════════════════════════════════════════════════════════════
-- DEBUGGING
-- ═══════════════════════════════════════════════════════════════════════════

('Debugging',
 'How do I debug authentication issues?',
 'Common authentication debugging steps:

**1. Check Environment Variables**
Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correctly set. Missing or incorrect values cause silent auth failures.

**2. Inspect the Session**
Open browser DevTools → Application → IndexedDB → look for Supabase session data. The session should contain `access_token`, `refresh_token`, and `user` object.

**3. Check Middleware Logs**
The middleware (`src/middleware.ts`) handles auth checks. Add `console.log` statements to trace the flow:
```typescript
console.log("Session:", session?.user?.email);
console.log("Role:", session?.user?.app_metadata?.app_role);
console.log("AAL:", aalData?.currentLevel);
```

**4. Common Issues:**
- **Redirect loop**: Usually caused by mismatched `NEXT_PUBLIC_SITE_URL` — ensure it matches your actual hostname.
- **MFA redirect loop**: The user''s role requires MFA but they can''t enroll — check that `supabase.auth.mfa.enroll()` isn''t throwing errors.
- **SSO 504 timeout**: Authentik container may be unreachable from Supabase auth — check Docker networking.
- **"Missing Supabase environment variables"**: The client-side Supabase client throws this if env vars are undefined at build time.',
 1, true, 'staff', ARRAY['debug', 'auth', 'login', 'session', 'mfa']),

('Debugging',
 'How do I debug Row Level Security (RLS) issues?',
 'When queries return empty results unexpectedly, RLS policies are usually the cause:

**1. Test Without RLS**
Use the Supabase service role key (bypasses RLS) to verify the data exists:
```sql
-- In Supabase SQL Editor (runs as postgres, bypasses RLS)
SELECT * FROM complaints WHERE hospital_id = ''your-uuid'';
```

**2. Check Active Policies**
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = ''public''
ORDER BY tablename;
```

**3. Test as a Specific User**
```sql
SET request.jwt.claims = ''{"sub": "user-uuid", "app_metadata": {"app_role": "Staff"}}'';
SET role = ''authenticated'';
SELECT * FROM complaints; -- Will apply RLS
RESET role;
```

**4. Common RLS Issues:**
- User''s `hospital_id` doesn''t match the row''s `hospital_id`
- The `app_role` in JWT doesn''t match what the policy expects
- Missing policy for the specific operation (SELECT vs INSERT vs UPDATE)
- The `auth.jwt()` function returns null in server-side contexts — use service role key instead',
 2, true, 'staff', ARRAY['debug', 'rls', 'security', 'permissions', 'database']),

('Debugging',
 'How do I check if the Inngest workflow engine is running?',
 'Inngest handles background workflows like SLA breach detection and escalation:

**1. Check the Inngest Dev Server**
If running locally, access the Inngest dashboard at `http://localhost:8288`. It shows registered functions, event history, and execution logs.

**2. Verify Function Registration**
Functions in `src/inngest/` should auto-register when the Next.js server starts. Check the terminal output for Inngest registration confirmations.

**3. Trigger a Test Event**
```typescript
import { inngest } from "@/inngest/client";
await inngest.send({ name: "test/hello", data: { message: "test" } });
```

**4. Common Issues:**
- Functions not appearing in the dashboard → ensure the API route at `/api/inngest` is properly configured
- Events not triggering → check that the event name matches exactly
- Timeouts → long-running functions may need `step.sleep()` to handle delays properly',
 3, true, 'staff', ARRAY['debug', 'inngest', 'workflow', 'background-jobs']),

('Debugging',
 'How do I debug the real-time subscription not updating?',
 'If the dashboard isn''t showing live updates:

**1. Check WebSocket Connection**
Open DevTools → Network → WS tab. You should see an active WebSocket connection to your Supabase URL. If missing, the connection failed to establish.

**2. Verify Channel Subscription**
In `src/lib/realtime-subscriptions.ts`, ensure the channel is subscribed to the correct table and filter:
```typescript
supabase.channel("complaints")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "complaints",
    filter: `hospital_id=eq.${hospitalId}`
  }, callback)
  .subscribe();
```

**3. Check Supabase Realtime Config**
In the Supabase Dashboard → Database → Replication, ensure the `complaints` table has replication enabled.

**4. Common Issues:**
- **Network/proxy blocking WebSockets** — corporate firewalls often block `wss://` connections
- **Channel not subscribing** — check for errors in the `.subscribe()` callback
- **RLS blocking realtime** — Supabase Realtime respects RLS policies; ensure the authenticated user has SELECT permission',
 4, true, 'staff', ARRAY['debug', 'realtime', 'websocket', 'subscription', 'live-updates']),

('Debugging',
 'How do I read the application logs for errors?',
 'The application provides multiple log sources:

**1. Next.js Server Logs**
Check the terminal running `pnpm dev` for server-side errors, API route failures, and middleware issues.

**2. Browser Console**
Client-side errors, failed fetches, and React rendering issues appear here. Filter by "Error" level for relevant issues.

**3. Sentry (if configured)**
If `SENTRY_DSN` is set, unhandled exceptions are automatically reported to Sentry with full stack traces, breadcrumbs, and user context. Check `sentry.client.config.ts` and `sentry.server.config.ts` for configuration.

**4. OpenTelemetry (if configured)**
Traces and metrics are exported to the configured OTLP endpoint. Use Jaeger, Grafana, or your preferred observability tool to visualize request traces.

**5. Supabase Logs**
For self-hosted: `docker compose logs -f supabase-auth` for auth issues, `docker compose logs -f supabase-rest` for PostgREST issues.',
 5, true, 'staff', ARRAY['debug', 'logs', 'sentry', 'otel', 'observability']),

-- ═══════════════════════════════════════════════════════════════════════════
-- TROUBLESHOOTING
-- ═══════════════════════════════════════════════════════════════════════════

('Troubleshooting',
 'The intake form shows "Failed to create transaction record" — how do I fix it?',
 'This error occurs when the complaint insertion into Supabase fails. Common causes:

**1. Missing `hospital_id`**
The intake form URL must include `?hospitalId=VALID_UUID`. If the UUID is invalid or the hospital doesn''t exist in the `hospitals` table, the insert fails.
- **Fix**: Verify the QR code URL contains a valid hospital UUID.

**2. RLS Policy Blocking Insert**
The `complaints` table has RLS policies. Anonymous or unauthenticated users need a policy allowing inserts.
- **Fix**: Check that a policy exists for unauthenticated inserts, or use the service role key for the API route.

**3. Database Connection Issue**
The Supabase instance may be unreachable.
- **Fix**: Verify `NEXT_PUBLIC_SUPABASE_URL` points to a running instance. For Docker: `docker compose ps` to check container status.

**4. Schema Mismatch**
If the migration was partially run, required columns may be missing.
- **Fix**: Re-run `007_complaints.sql` and `008_complaint_phi.sql`.',
 1, true, 'all', ARRAY['troubleshoot', 'error', 'intake', 'transaction', 'complaint']),

('Troubleshooting',
 'I get "Bad Gateway" when trying to access Authentik admin — what do I do?',
 'A 502/Bad Gateway error from Authentik usually indicates:

**1. Container Not Running**
```bash
docker compose -f authentik-compose.yml ps
```
Look for non-running containers. Restart with:
```bash
docker compose -f authentik-compose.yml up -d
```

**2. Worker Container Crashed**
The Authentik worker handles background tasks. If it OOMs or crashes:
```bash
docker compose -f authentik-compose.yml logs authentik-worker --tail 50
```
Increase memory limits in `authentik-compose.yml` if needed.

**3. Database Connection Lost**
Authentik uses its own PostgreSQL instance. Check connectivity:
```bash
docker compose -f authentik-compose.yml logs authentik-db --tail 50
```

**4. Port Conflict**
Ensure Authentik''s port (default 9000/9443) isn''t occupied by another service.',
 2, true, 'staff', ARRAY['troubleshoot', 'authentik', 'bad-gateway', '502', 'docker']),

('Troubleshooting',
 'The dashboard shows "No facilities registered" even though hospitals exist — why?',
 'This happens when the Organization Dashboard query returns no results for the current session''s organisation.

**1. Check `NEXT_PUBLIC_ORG_ID` env var**
Ensure this is set to your production Organisation UUID (from `database/seeds/bootstrap.sql` Section 1).

**2. Verify Hospital → Organization Link**
```sql
SELECT id, name, organization_id FROM hospitals;
```
Each hospital must have its `organization_id` set to match your organisation''s UUID.

**3. Materialized Views Need Refresh**
The dashboard queries materialized views. If they''re stale:
```sql
REFRESH MATERIALIZED VIEW mv_org_sla_compliance;
REFRESH MATERIALIZED VIEW mv_org_complaint_trends;
REFRESH MATERIALIZED VIEW mv_org_resolution_benchmarks;
```',
 3, true, 'staff', ARRAY['troubleshoot', 'dashboard', 'no-data', 'organization']),

('Troubleshooting',
 'QR code page shows a blank page or fails to load — how do I fix it?',
 'The QR code generation page at `/mock-qr` depends on the `qrcode` npm package:

**1. Check Dependencies**
Ensure the package is installed:
```bash
pnpm list qrcode
```
If missing: `pnpm add qrcode @types/qrcode`

**2. Check the `hospitalId` Parameter**
The page expects `?hospitalId=VALID_UUID` to generate the correct intake URL. Without it, the QR code has no target.

**3. Canvas Rendering Issues**
The QR library uses canvas for rendering. In some environments (e.g., SSR without proper polyfills), this can fail. Ensure the component is wrapped in a `"use client"` directive.

**4. Browser Compatibility**
The QR generation uses browser Canvas API. Try a modern browser (Chrome, Edge, Firefox) if issues persist.',
 4, true, 'staff', ARRAY['troubleshoot', 'qr-code', 'blank-page', 'dependency']),

('Troubleshooting',
 'Build fails with TypeScript errors — what should I check?',
 'TypeScript build errors are common during development. Systematic debugging:

**1. Run Type Check Separately**
```bash
npx tsc --noEmit > tsc_output.txt 2>&1
```
This captures all errors without building.

**2. Common Error Patterns:**
- **"Cannot find module ''''@/...''''"** — Verify `tsconfig.json` path aliases and that the file exists.
- **"Type X is not assignable to type Y"** — Usually a Supabase response type mismatch. Use type assertions or handle nullable fields.
- **"Property does not exist"** — The database response doesn''t match your TypeScript interface. Update the interface or add optional chaining (`?.`).

**3. Dependency Issues**
```bash
pnpm install  # Reinstall dependencies
rm -rf .next  # Clear Next.js build cache
```

**4. Version Conflicts**
Check that React, Next.js, and Supabase package versions are compatible. The project uses React 19 and Next.js 16, which have specific requirements.',
 5, true, 'staff', ARRAY['troubleshoot', 'typescript', 'build', 'error', 'compile']),

('Troubleshooting',
 'The idle timeout keeps logging me out too quickly — how do I adjust it?',
 'The idle timeout is controlled by the `IdleTimeout` component in `src/components/auth/IdleTimeout.tsx`:

1. Open the component file.
2. Look for the timeout duration constant (usually in milliseconds).
3. Increase the value — e.g., from `15 * 60 * 1000` (15 minutes) to `30 * 60 * 1000` (30 minutes).

**Security Consideration**: For clinical environments, NABH guidelines recommend sessions no longer than 30 minutes of inactivity. Balance usability with compliance requirements.

**Note**: The `IdleTimeout` component is mounted in the root layout (`src/app/layout.tsx`), so changes apply globally.',
 6, true, 'staff', ARRAY['troubleshoot', 'timeout', 'session', 'idle', 'logout']),

-- ═══════════════════════════════════════════════════════════════════════════
-- GENERAL / COMPLIANCE
-- ═══════════════════════════════════════════════════════════════════════════

('General',
 'What compliance standards does this platform support?',
 'The platform is designed for compliance with:

- **NABH PRE.7** — Patient grievance redressal standards, including mandatory acknowledgement within 24 hours and documented resolution workflows.
- **JCI Standards** — International hospital accreditation requirements for patient rights and safety.
- **Indian IT Act / DPDP Act** — Data protection requirements including PHI encryption (AES-256-GCM), consent management, and data minimization.

Key compliance features:
- Immutable audit trails (tamper-proof logging)
- PHI-separated storage (dual-table architecture)
- Encrypted IndexedDB for client-side session storage
- Role-based access control with MFA enforcement
- SLA monitoring with automated escalation
- CAPA (Corrective and Preventive Action) tracking',
 1, true, 'all', ARRAY['compliance', 'nabh', 'jci', 'dpdp', 'security']),

('General',
 'How is patient data (PHI) protected in the system?',
 'Patient Health Information (PHI) is protected through multiple layers:

**1. Dual-Table Architecture**
- `complaints` table: Contains only non-PHI metadata (severity, status, timestamps, department)
- `complaint_phi` table: Contains patient name, contact, and complaint details — encrypted and access-controlled

**2. Encryption**
- Client-side sessions use AES-256-GCM encrypted IndexedDB storage (`src/lib/encrypted-storage.ts`)
- Database-level encryption via Supabase''s built-in TDE (Transparent Data Encryption)

**3. Access Control**
- RLS policies restrict PHI access to authorized roles only
- Every PHI access is audit-logged with user identity and timestamp
- The PHI Detail Modal component logs access automatically

**4. Data Minimization**
- The Organization Dashboard uses materialized views that strip PHI
- Reports and exports never include raw patient data
- DPO (Data Protection Officer) has dedicated tools for consent and data subject requests',
 2, true, 'all', ARRAY['phi', 'privacy', 'encryption', 'data-protection', 'security'])

ON CONFLICT DO NOTHING;
