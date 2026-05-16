"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Save,
  X,
  BookOpen,
  Filter,
  Users,
  Tag,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowUpDown,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAppDate } from "@/lib/app-time";

/* ─────────────────────────── Types ─────────────────────────── */

interface FAQ {
  id: string;
  hospital_id: string | null;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
  target_audience: "patient" | "staff" | "all";
  tags: string[];
  created_at: string;
  updated_at: string;
}

type ViewMode = "list" | "grid";

const DEFAULT_CATEGORIES = [
  "General",
  "Complaints Process",
  "Privacy & Data",
  "SLA & Timelines",
  "Escalation",
  "Patient Rights",
  "Staff Procedures",
  "Accreditation",
];

const AUDIENCE_CONFIG = {
  patient: { label: "Patient", color: "bg-sky-100 text-sky-700 border-sky-200" },
  staff: { label: "Staff", color: "bg-amber-100 text-amber-700 border-amber-200" },
  all: { label: "Everyone", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

/* ─────────────────────────── Demo Data ─────────────────────────── */

const DEMO_FAQS: FAQ[] = [
  // ── Initial Setup ──
  {
    id: "demo-001", hospital_id: null, category: "Initial Setup",
    question: "How do I set up the platform for the first time?",
    answer: "Follow these steps to complete the initial platform setup:\n\n1. Environment configuration: copy .env.example to .env and provide the current Supabase, app URL, Redis, and signing-secret values required by the deployment.\n2. Database migration: apply the full migration set in database/migrations so the schema, helpers, and RLS policies are current.\n3. Seed or bootstrap data: load the supported bootstrap seed for demo organizations, hospitals, departments, and staff records.\n4. Identity setup: provision staff identities in Supabase Auth and create the matching public.users and user_department_assignments records used by the app runtime.\n5. Start the app: run pnpm install followed by pnpm dev.\n6. First login: navigate to /login and sign in with a provisioned account. There are no default shared admin credentials in the hardened flow.",
    sort_order: 1, is_published: true, target_audience: "staff", tags: ["setup", "installation", "getting-started"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-002", hospital_id: null, category: "Initial Setup",
    question: "What environment variables are required?",
    answer: "The following environment variables are required for a standard deployment:\n\n• NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL\n• NEXT_PUBLIC_SUPABASE_ANON_KEY - The public key used by browser and SSR user-scoped clients\n• SUPABASE_SERVICE_ROLE_KEY - Server-only key used by the centralized admin client\n• ACKNOWLEDGE_LINK_SECRET - Dedicated HMAC secret for signed acknowledge links\n• NEXT_PUBLIC_SITE_URL - Canonical site origin for auth callbacks and WebAuthn\n• NEXT_PUBLIC_APP_URL - Public app base URL used for generated intake links and QR codes\n\nOptional variables:\n• SENTRY_DSN - Error tracking\n• OTEL_EXPORTER_OTLP_ENDPOINT - OpenTelemetry collector endpoint\n• REDIS_URL - Redis connection string for rate limiting",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["env", "configuration", "environment"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-003", hospital_id: null, category: "Initial Setup",
    question: "How do I run the database migrations?",
    answer: "Database migrations are located in database/migrations/ and should be executed sequentially:\n\n1. Open the Supabase SQL editor (or use psql for self-hosted instances).\n2. Run each migration file in order: 001_organizations.sql, 002_hospitals.sql, etc.\n3. After all schema migrations, run the unified bootstrap seed: psql $DATABASE_URL -f database/seeds/bootstrap.sql\n\nImportant: Migrations are idempotent — they use IF NOT EXISTS clauses, so re-running them is safe. The bootstrap seed uses ON CONFLICT DO NOTHING so it is also safe to run multiple times.",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["database", "migration", "sql", "supabase"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-004", hospital_id: null, category: "Initial Setup",
    question: "How do I configure SSO with Authentik?",
    answer: "To set up SAML-based SSO with Authentik:\n\n1. Create a Provider in Authentik: Go to Applications → Providers → Create → SAML Provider. Set the ACS URL to {SUPABASE_URL}/auth/v1/sso/saml/acs and Entity ID to {SUPABASE_URL}/auth/v1/sso/saml/metadata.\n2. Create an Application: Link it to the SAML provider you just created.\n3. Download Metadata: Export the metadata XML from Authentik.\n4. Register in Supabase: Use the Supabase Admin API or SQL to register the SSO provider with the metadata XML.\n5. Test: Navigate to /login and click \"Sign in with SSO\". You should be redirected to Authentik.\n\nTroubleshooting: If you get a 504 timeout, ensure the Authentik container is reachable from the Supabase auth container. Check Docker networking.",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["sso", "authentik", "saml", "authentication"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-005", hospital_id: null, category: "Initial Setup",
    question: "How do I access the admin panel after setup?",
    answer: "After provisioning your account via Authentik SSO, navigate to /login and authenticate via SSO. You will be redirected to your role-based dashboard automatically. If you are an Admin, you will see the Organisation Intelligence dashboard.\n\nSecurity Note: All staff accounts must be provisioned via Authentik — there are no default shared credentials. Contact your IT administrator to have your account created and the correct role assigned.",
    sort_order: 5, is_published: true, target_audience: "staff", tags: ["login", "admin", "access"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── Admin Panel Operations ──
  {
    id: "demo-006", hospital_id: null, category: "Admin Panel Operations",
    question: "How do I access the Organization Dashboard?",
    answer: "Navigate to /org-dashboard after logging in with an Admin role account. The dashboard displays:\n\n• Global SLA Compliance — Aggregated compliance percentage across all hospitals\n• SLA Breach Count — Number of cross-organization breaches\n• Intake Volume — Total grievances received (month-to-date)\n• Resolution Timeline — Average resolution time in hours\n• CAPA Effectiveness — Before/after comparison of corrective actions\n• Hospital Drill-Down — Per-facility cards with NABH/JCI accreditation status and QC report downloads\n\nThe dashboard is server-side rendered and uses PHI-stripped materialized views for compliance.",
    sort_order: 1, is_published: true, target_audience: "staff", tags: ["dashboard", "org", "analytics", "compliance"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-007", hospital_id: null, category: "Admin Panel Operations",
    question: "How do I configure SLA thresholds?",
    answer: "SLA (Service Level Agreement) thresholds control the acknowledgement and resolution time limits:\n\n1. Go to Settings → SLA Configuration (/settings/sla-config).\n2. Adjust the Acknowledgement Threshold (default: 24 hours per NABH PRE.7).\n3. Adjust the Resolution Threshold (default: 30 days for standard, 7 days for critical severity).\n4. Save changes.\n\nSLA breaches are automatically detected by the system and logged in the sla_breach_log table. Breach events trigger escalation notifications via the Inngest workflow engine.\n\nNote: Changing thresholds does not retroactively affect existing complaints.",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["sla", "configuration", "thresholds", "nabh"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-008", hospital_id: null, category: "Admin Panel Operations",
    question: "How do I export compliance reports?",
    answer: "Compliance reports can be exported in two ways:\n\nPDF Export:\n1. From the Organization Dashboard, locate the hospital card.\n2. Click \"Download QC Report\" — this generates a PDF via the /api/export-pdf endpoint.\n3. The PDF includes SLA metrics, breach counts, trending data, and CAPA summaries.\n\nCSV Export:\n1. Navigate to the staff dashboard data table.\n2. Use the built-in export functionality to download complaint data as CSV.\n\nAll exports are PHI-stripped and audit-logged. The audit trail records who exported what and when, stored in the audit_logs table.",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["export", "pdf", "csv", "compliance", "report"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-009", hospital_id: null, category: "Admin Panel Operations",
    question: "How does the real-time notification system work?",
    answer: "The platform uses Supabase Realtime Subscriptions for live updates:\n\n• New Complaints: Staff see incoming complaints in real-time without page refresh.\n• Status Changes: When a complaint is acknowledged or resolved, all connected users see the update.\n• SLA Breach Alerts: Triggered when thresholds are exceeded, visible to admins and relevant department heads.\n\nThe subscription logic is in src/lib/realtime-subscriptions.ts. Channels are scoped by hospital_id for data isolation.\n\nNote: If real-time updates stop working, check the Supabase Realtime service status and ensure WebSocket connections are not blocked by your network/proxy.",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["realtime", "notifications", "websocket", "supabase"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-010", hospital_id: null, category: "Admin Panel Operations",
    question: "How do I manage the FAQ Knowledge Base?",
    answer: "The FAQ system is accessible at /faq-management:\n\n1. Create: Click \"Create FAQ\" → fill in question, answer, category, audience, tags, and sort order.\n2. Edit: Hover over any FAQ → click the pencil icon to modify.\n3. Publish/Unpublish: Toggle visibility with the eye icon. Only published FAQs are visible to patients.\n4. Delete: Click the trash icon → confirm deletion.\n5. Search: Use the search bar to filter by question text, answer content, or tags.\n6. Filter: Narrow results by category, target audience, or publish status.\n7. View Modes: Toggle between List (accordion) and Grid (cards) views.\n\nFAQs support custom categories beyond the presets, and each FAQ can target Patients, Staff, or Everyone.",
    sort_order: 5, is_published: true, target_audience: "all", tags: ["faq", "knowledge-base", "content-management"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── Employee & Department Management ──
  {
    id: "demo-011", hospital_id: null, category: "Employee & Department Management",
    question: "How do I create a new department?",
    answer: "Departments are created via direct database insertion (admin UI planned for future sprint):\n\nINSERT INTO departments (hospital_id, name, head_email)\nVALUES (\n  'your-hospital-uuid',\n  'Cardiology',\n  'head.cardiology@hospital.local'\n);\n\nEach department must be linked to a valid hospital_id. The head_email should correspond to a registered user who will receive escalation notifications for that department.\n\nVia Supabase Dashboard:\n1. Open the Supabase Table Editor → departments table.\n2. Click \"Insert Row\" and fill in the fields.\n3. Save.\n\nDepartments appear in complaint routing dropdowns once created.",
    sort_order: 1, is_published: true, target_audience: "staff", tags: ["department", "create", "hospital", "setup"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-012", hospital_id: null, category: "Employee & Department Management",
    question: "How do I provision a new staff member?",
    answer: "Provisioning now uses the application tables as the source of truth for role and scope:\n\n1. Create the Supabase auth identity for the staff member.\n2. Create or update the matching row in public.users with the staff member's role, hospital, phone/email, and active status.\n3. Add one or more rows in user_department_assignments for the departments they are allowed to operate in.\n4. If the user needs privileged access, ensure they complete MFA enrollment after first login.\n\nImportant: Do not store role or department scope in auth.users raw_app_meta_data. Runtime authorization now reads from public.users, department assignments, session context, and shared server-side guards.",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["user", "staff", "provisioning", "create", "role"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-013", hospital_id: null, category: "Employee & Department Management",
    question: "What roles are available and what can each do?",
    answer: "The system supports these roles with increasing privilege levels:\n\n• Staff - View assigned complaints, update status, add notes\n• Department Manager - All Staff permissions plus department-level oversight\n• Quality Coordinator - All Manager permissions plus SLA configuration and compliance reporting\n• Medical Superintendent - Cross-department oversight and escalated reporting access\n• Admin - Full platform administration\n\nPrivileged roles must complete MFA before protected actions are allowed.\n\nRoles are stored in public.users.role. Effective access is enforced by shared auth guards, hospital and department assignments, active session context, and Row Level Security.",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["roles", "permissions", "rbac", "mfa", "security"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-014", hospital_id: null, category: "Employee & Department Management",
    question: "How do I set up on-call schedules for departments?",
    answer: "On-call schedules determine which staff member receives escalation notifications:\n\nINSERT INTO on_call_schedules (department_id, user_id, start_time, end_time, day_of_week)\nVALUES (\n  'department-uuid',\n  'user-uuid',\n  '08:00:00',\n  '20:00:00',\n  1  -- Monday (1=Mon, 7=Sun)\n);\n\nWhen an SLA breach occurs, the system checks the on_call_schedules table to identify the responsible staff member for the relevant department and time slot.\n\nBest Practice: Ensure complete coverage — every department should have on-call assignments for all 7 days to avoid missed escalations.",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["on-call", "schedule", "escalation", "department"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-015", hospital_id: null, category: "Employee & Department Management",
    question: "How do I deactivate a staff account?",
    answer: "To deactivate a staff member without deleting their data:\n\nOption 1: Disable Auth Login\nVia Supabase Dashboard → Authentication → Users → find the user → click \"Ban User\". This prevents login while preserving all audit trails and complaint history.\n\nOption 2: Via API\ncurl -X PUT '{SUPABASE_URL}/auth/v1/admin/users/{USER_ID}' -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' -d '{\"ban_duration\": \"876000h\"}'\n\nImportant: Never delete auth users directly — this breaks foreign key references in audit_logs, complaints, and complaint_status_history. Always use the ban/disable approach.",
    sort_order: 5, is_published: true, target_audience: "staff", tags: ["deactivate", "disable", "user", "ban", "offboarding"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── Walkthroughs ──
  {
    id: "demo-016", hospital_id: null, category: "Walkthroughs",
    question: "Walkthrough: Processing a patient complaint end-to-end",
    answer: "Complete lifecycle of a grievance from intake to resolution:\n\n1. Patient Submits Complaint\nPatient scans the hospital QR code → lands on the intake form → fills in complaint details → submits. The form creates records in both complaints (non-PHI metadata) and complaint_phi (encrypted patient details).\n\n2. Acknowledgement\nStaff sees the new complaint in real-time on the dashboard. They click to acknowledge → system records timestamp. The SLA acknowledgement clock stops.\n\n3. Investigation & Assignment\nStaff routes the complaint to the appropriate department. The department head is notified via the escalation system.\n\n4. Resolution\nThe assigned staff member investigates, takes corrective action, and marks the complaint as resolved. Resolution notes are added.\n\n5. SLA Monitoring\nThroughout the process, the system monitors SLA thresholds. If acknowledgement exceeds 24h or resolution exceeds the configured limit, an SLA breach is logged and escalation triggers.\n\n6. Reporting\nAdmins view aggregated metrics on the Organization Dashboard. CAPA effectiveness is tracked via before/after volume comparisons.",
    sort_order: 1, is_published: true, target_audience: "all", tags: ["walkthrough", "complaint", "lifecycle", "process"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-017", hospital_id: null, category: "Walkthroughs",
    question: "Walkthrough: Setting up a new hospital facility",
    answer: "Steps to onboard a new hospital into the platform:\n\n1. Create the Hospital Record — INSERT INTO hospitals (organization_id, name, nabh_accredited, jci_accredited) VALUES ('org-uuid', 'City General Hospital', true, false);\n\n2. Create Departments — Add at least the core departments (see Department Creation FAQ).\n\n3. Generate QR Codes — Navigate to /mock-qr to generate the patient intake QR code for the new hospital.\n\n4. Provision Staff — Create auth users and assign them to the new hospital (see Staff Provisioning FAQ).\n\n5. Configure SLAs — Set acknowledgement and resolution thresholds specific to this facility.\n\n6. Set On-Call Schedules — Assign staff to on-call rotations for each department.\n\n7. Verify — Submit a test complaint via the QR code and verify it appears on the staff dashboard.",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["walkthrough", "hospital", "onboarding", "setup"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-018", hospital_id: null, category: "Walkthroughs",
    question: "Walkthrough: Configuring MFA for privileged roles",
    answer: "Multi-Factor Authentication is mandatory for Admin, Quality Coordinator, Medical Superintendent, and Department Manager roles.\n\nHow it works:\n\n1. The user completes the primary login flow and receives a normal session.\n2. Shared auth guards detect that the role is privileged and route the user to MFA enrollment or challenge before protected actions continue.\n3. Enrollment: the user registers a verified factor such as TOTP.\n4. Challenge: on later logins, the user completes the challenge for that factor.\n5. After successful verification, the session is elevated to AAL2 and the user is redirected to the requested protected page.\n\nIf a user loses access to their factor, an administrator can reset the enrolled factor using the managed Supabase authentication workflow.",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["walkthrough", "mfa", "totp", "security", "2fa"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-019", hospital_id: null, category: "Walkthroughs",
    question: "Walkthrough: Understanding the audit trail system",
    answer: "Every sensitive operation is immutably logged for NABH/JCI compliance.\n\nWhat gets logged:\n• PHI access (viewing patient details in the detail modal)\n• Complaint status changes (acknowledged, resolved, escalated)\n• SLA breach events\n• User login/logout events\n• Data exports (PDF/CSV)\n• Configuration changes (SLA thresholds)\n\nWhere it's stored:\n• audit_logs table — tamper-proof with immutable triggers (cannot be updated or deleted)\n• Each entry includes: action, table_name, record_id, old_data, new_data, performed_by, ip_address, timestamp\n\nViewing Audit Logs:\n• Admins can query the audit_logs table directly via the Supabase Dashboard.\n• The PHI Detail Modal automatically logs access when a staff member views patient information.\n\nCompliance: The immutable audit trigger (018_immutable_audit_triggers.sql) prevents any modification or deletion of audit records, ensuring chain-of-custody integrity.",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["walkthrough", "audit", "compliance", "logging", "nabh", "jci"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── Debugging ──
  {
    id: "demo-020", hospital_id: null, category: "Debugging",
    question: "How do I debug authentication issues?",
    answer: "Common authentication debugging steps:\n\n1. Check environment variables - ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL, and any feature-specific auth secrets are set correctly.\n\n2. Inspect the session cookies - this app uses cookie-backed SSR sessions, so verify the Supabase auth cookies are present and refreshing correctly.\n\n3. Check proxy and auth-guard behaviour - src/proxy.ts refreshes the session and session context, while src/lib/auth-guard.ts resolves the authenticated user, role, department scope, and MFA level.\n\n4. Review structured logs - auth callback, OTP, MFA, and reporting flows now log through the shared logger instead of ad hoc console output.\n\n5. Common issues:\n• Redirect loop - usually caused by stale cookies or mismatched NEXT_PUBLIC_SITE_URL.\n• MFA loop - the user has a privileged role but no enrolled or verified factor.\n• Missing staff profile - the auth identity exists but public.users or user_department_assignments is incomplete.\n• Callback failure - the auth code exchange failed or redirected to the wrong origin.",
    sort_order: 1, is_published: true, target_audience: "staff", tags: ["debug", "auth", "login", "session", "mfa"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-021", hospital_id: null, category: "Debugging",
    question: "How do I debug Row Level Security (RLS) issues?",
    answer: "When queries return empty results unexpectedly, RLS policies are usually the cause:\n\n1. Confirm the data exists with an approved admin workflow, not by wiring a service-role client into user-facing code.\n\n2. Check active policies:\nSELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;\n\n3. Validate the current identity model:\n• public.users.role is the source of truth for role\n• user_department_assignments controls department scope\n• staff_session_context and forwarded headers determine the active department for float staff\n\n4. Test helper output from SQL where applicable:\nSELECT public.get_my_role(), public.get_my_hospital_id(), public.get_active_department_id();\n\n5. Common RLS issues:\n• The user's hospital_id does not match the row's hospital_id\n• The active department is missing or out of scope\n• A required department assignment is inactive\n• The policy assumes a different complaint status or role name than the app is using",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["debug", "rls", "security", "permissions", "database"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-022", hospital_id: null, category: "Debugging",
    question: "How do I check if the Inngest workflow engine is running?",
    answer: "Inngest handles background workflows like SLA breach detection and escalation:\n\n1. Check the Inngest Dev Server — If running locally, access the Inngest dashboard at http://localhost:8288. It shows registered functions, event history, and execution logs.\n\n2. Verify Function Registration — Functions in src/inngest/ should auto-register when the Next.js server starts. Check the terminal output for Inngest registration confirmations.\n\n3. Trigger a Test Event — Use inngest.send({ name: \"test/hello\", data: { message: \"test\" } });\n\n4. Common Issues:\n• Functions not appearing in the dashboard → ensure the API route at /api/inngest is properly configured\n• Events not triggering → check that the event name matches exactly\n• Timeouts → long-running functions may need step.sleep() to handle delays properly",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["debug", "inngest", "workflow", "background-jobs"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-023", hospital_id: null, category: "Debugging",
    question: "How do I debug the real-time subscription not updating?",
    answer: "If the dashboard isn't showing live updates:\n\n1. Check WebSocket Connection — Open DevTools → Network → WS tab. You should see an active WebSocket connection to your Supabase URL. If missing, the connection failed to establish.\n\n2. Verify Channel Subscription — In src/lib/realtime-subscriptions.ts, ensure the channel is subscribed to the correct table and filter.\n\n3. Check Supabase Realtime Config — In the Supabase Dashboard → Database → Replication, ensure the complaints table has replication enabled.\n\n4. Common Issues:\n• Network/proxy blocking WebSockets — corporate firewalls often block wss:// connections\n• Channel not subscribing — check for errors in the .subscribe() callback\n• RLS blocking realtime — Supabase Realtime respects RLS policies; ensure the authenticated user has SELECT permission",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["debug", "realtime", "websocket", "subscription", "live-updates"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-024", hospital_id: null, category: "Debugging",
    question: "How do I read the application logs for errors?",
    answer: "The application provides multiple log sources:\n\n1. Next.js Server Logs — Check the terminal running pnpm dev for server-side errors, API route failures, and middleware issues.\n\n2. Browser Console — Client-side errors, failed fetches, and React rendering issues appear here. Filter by \"Error\" level for relevant issues.\n\n3. Sentry (if configured) — If SENTRY_DSN is set, unhandled exceptions are automatically reported to Sentry with full stack traces, breadcrumbs, and user context.\n\n4. OpenTelemetry (if configured) — Traces and metrics are exported to the configured OTLP endpoint. Use Jaeger, Grafana, or your preferred observability tool to visualize request traces.\n\n5. Supabase Logs — For self-hosted: docker compose logs -f supabase-auth for auth issues, docker compose logs -f supabase-rest for PostgREST issues.",
    sort_order: 5, is_published: true, target_audience: "staff", tags: ["debug", "logs", "sentry", "otel", "observability"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── Troubleshooting ──
  {
    id: "demo-025", hospital_id: null, category: "Troubleshooting",
    question: "The intake form shows \"Failed to create transaction record\" — how do I fix it?",
    answer: "This error occurs when the complaint insert into Supabase fails. Common causes:\n\n1. Missing hospital_id - The intake form URL must include ?hospital_id=VALID_UUID. If the UUID is invalid or the hospital does not exist, the insert is rejected.\nFix: Verify the QR code URL contains a valid hospital_id value.\n\n2. Validation or scope failure - The intake flow now rejects missing hospital context instead of falling back to a default facility.\nFix: Regenerate the QR code or intake link with the correct hospital context.\n\n3. Database connectivity issue - The Supabase instance may be unreachable.\nFix: Verify NEXT_PUBLIC_SUPABASE_URL points to the intended project and that the database is healthy.\n\n4. Schema mismatch - If migrations are missing, required complaint or complaint_phi columns may not exist.\nFix: Apply the latest migrations and confirm the complaint tables are aligned before retrying.",
    sort_order: 1, is_published: true, target_audience: "all", tags: ["troubleshoot", "error", "intake", "transaction", "complaint"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-026", hospital_id: null, category: "Troubleshooting",
    question: "I get \"Bad Gateway\" when trying to access Authentik admin — what do I do?",
    answer: "A 502/Bad Gateway error from Authentik usually indicates:\n\n1. Container Not Running — Run: docker compose -f authentik-compose.yml ps. Look for non-running containers. Restart with: docker compose -f authentik-compose.yml up -d\n\n2. Worker Container Crashed — The Authentik worker handles background tasks. If it OOMs or crashes: docker compose -f authentik-compose.yml logs authentik-worker --tail 50. Increase memory limits in authentik-compose.yml if needed.\n\n3. Database Connection Lost — Authentik uses its own PostgreSQL instance. Check connectivity: docker compose -f authentik-compose.yml logs authentik-db --tail 50\n\n4. Port Conflict — Ensure Authentik's port (default 9000/9443) isn't occupied by another service.",
    sort_order: 2, is_published: true, target_audience: "staff", tags: ["troubleshoot", "authentik", "bad-gateway", "502", "docker"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-027", hospital_id: null, category: "Troubleshooting",
    question: "The dashboard shows \"No facilities registered\" even though hospitals exist — why?",
    answer: "This happens when the Organization Dashboard query returns no results for the current session's organisation:\n\n1. Verify Hospital → Organization Link — Run: SELECT id, name, organization_id FROM hospitals; Each hospital must have its organization_id set to match your organisation's UUID from the bootstrap seed.\n\n2. Check the NEXT_PUBLIC_ORG_ID env var — Ensure this is set to your production Organisation UUID (from database/seeds/bootstrap.sql Section 1).\n\n3. Materialized Views Need Refresh — The dashboard queries materialized views. If they're stale:\nREFRESH MATERIALIZED VIEW mv_org_sla_compliance;\nREFRESH MATERIALIZED VIEW mv_org_complaint_trends;\nREFRESH MATERIALIZED VIEW mv_org_resolution_benchmarks;",
    sort_order: 3, is_published: true, target_audience: "staff", tags: ["troubleshoot", "dashboard", "no-data", "organization"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-028", hospital_id: null, category: "Troubleshooting",
    question: "QR code page shows a blank page or fails to load — how do I fix it?",
    answer: "The QR code generation page at /mock-qr depends on the qrcode npm package:\n\n1. Check Dependencies — Ensure the package is installed: pnpm list qrcode. If missing: pnpm add qrcode @types/qrcode\n\n2. Check the hospital selection flow — Load hospitals first, then generate assets for a real hospital record so the QR encodes /intake?hospital_id=VALID_UUID.\n\n3. Canvas Rendering Issues — The QR library uses canvas for rendering. In some environments (e.g., SSR without proper polyfills), this can fail. Ensure the component is wrapped in a \"use client\" directive.\n\n4. Browser Compatibility — The QR generation uses browser Canvas API. Try a modern browser (Chrome, Edge, Firefox) if issues persist.",
    sort_order: 4, is_published: true, target_audience: "staff", tags: ["troubleshoot", "qr-code", "blank-page", "dependency"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-029", hospital_id: null, category: "Troubleshooting",
    question: "Build fails with TypeScript errors — what should I check?",
    answer: "TypeScript build errors are common during development. Systematic debugging:\n\n1. Run Type Check Separately — npx tsc --noEmit > tsc_output.txt 2>&1. This captures all errors without building.\n\n2. Common Error Patterns:\n• \"Cannot find module '@/...'\" — Verify tsconfig.json path aliases and that the file exists.\n• \"Type X is not assignable to type Y\" — Usually a Supabase response type mismatch. Use type assertions or handle nullable fields.\n• \"Property does not exist\" — The database response doesn't match your TypeScript interface. Update the interface or add optional chaining (?.).\n\n3. Dependency Issues — Run: pnpm install (reinstall dependencies) then rm -rf .next (clear Next.js build cache).\n\n4. Version Conflicts — Check that React, Next.js, and Supabase package versions are compatible. The project uses React 19 and Next.js 16, which have specific requirements.",
    sort_order: 5, is_published: true, target_audience: "staff", tags: ["troubleshoot", "typescript", "build", "error", "compile"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-030", hospital_id: null, category: "Troubleshooting",
    question: "The idle timeout keeps logging me out too quickly — how do I adjust it?",
    answer: "The idle timeout is controlled by the IdleTimeout component in src/components/auth/IdleTimeout.tsx:\n\n1. Open the component file.\n2. Look for the timeout duration constant (usually in milliseconds).\n3. Increase the value — e.g., from 15 * 60 * 1000 (15 minutes) to 30 * 60 * 1000 (30 minutes).\n\nSecurity Consideration: For clinical environments, NABH guidelines recommend sessions no longer than 30 minutes of inactivity. Balance usability with compliance requirements.\n\nNote: The IdleTimeout component is mounted in the root layout (src/app/layout.tsx), so changes apply globally.",
    sort_order: 6, is_published: true, target_audience: "staff", tags: ["troubleshoot", "timeout", "session", "idle", "logout"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },

  // ── General / Compliance ──
  {
    id: "demo-031", hospital_id: null, category: "General",
    question: "What compliance standards does this platform support?",
    answer: "The platform is designed for compliance with:\n\n• NABH PRE.7 — Patient grievance redressal standards, including mandatory acknowledgement within 24 hours and documented resolution workflows.\n• JCI Standards — International hospital accreditation requirements for patient rights and safety.\n• Indian IT Act / DPDP Act — Data protection requirements including PHI encryption (AES-256-GCM), consent management, and data minimization.\n\nKey compliance features:\n• Immutable audit trails (tamper-proof logging)\n• PHI-separated storage (dual-table architecture)\n• Encrypted IndexedDB for client-side session storage\n• Role-based access control with MFA enforcement\n• SLA monitoring with automated escalation\n• CAPA (Corrective and Preventive Action) tracking",
    sort_order: 1, is_published: true, target_audience: "all", tags: ["compliance", "nabh", "jci", "dpdp", "security"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
  {
    id: "demo-032", hospital_id: null, category: "General",
    question: "How is patient data (PHI) protected in the system?",
    answer: "Patient Health Information (PHI) is protected through multiple layers:\n\n1. Dual-Table Architecture\n• complaints table: Contains only non-PHI metadata (severity, status, timestamps, department)\n• complaint_phi table: Contains patient name, contact, and complaint details — encrypted and access-controlled\n\n2. Encryption\n• Client-side sessions use AES-256-GCM encrypted IndexedDB storage (src/lib/encrypted-storage.ts)\n• Database-level encryption via Supabase's built-in TDE (Transparent Data Encryption)\n\n3. Access Control\n• RLS policies restrict PHI access to authorized roles only\n• Every PHI access is audit-logged with user identity and timestamp\n• The PHI Detail Modal component logs access automatically\n\n4. Data Minimization\n• The Organization Dashboard uses materialized views that strip PHI\n• Reports and exports never include raw patient data\n• DPO (Data Protection Officer) has dedicated tools for consent and data subject requests",
    sort_order: 2, is_published: true, target_audience: "all", tags: ["phi", "privacy", "encryption", "data-protection", "security"],
    created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z"
  },
];

/* ─────────────────────────── Helpers ─────────────────────────── */

function groupByCategory(faqs: FAQ[]): Record<string, FAQ[]> {
  return faqs.reduce((acc, faq) => {
    const cat = faq.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>);
}

/* ─────────────────────────── Toast ─────────────────────────── */

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium shadow-2xl backdrop-blur-sm border ${
        type === "success"
          ? "bg-emerald-50/95 text-emerald-800 border-emerald-200"
          : "bg-rose-50/95 text-rose-800 border-rose-200"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

/* ─────────────────────────── FAQ Form Modal ─────────────────────────── */

function FAQFormModal({
  faq,
  onSave,
  onClose,
}: {
  faq: FAQ | null;
  onSave: (data: Partial<FAQ>) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(faq?.question || "");
  const [answer, setAnswer] = useState(faq?.answer || "");
  const [category, setCategory] = useState(faq?.category || "General");
  const [customCategory, setCustomCategory] = useState("");
  const [audience, setAudience] = useState<"patient" | "staff" | "all">(
    faq?.target_audience || "patient"
  );
  const [published, setPublished] = useState(faq?.is_published || false);
  const [sortOrder, setSortOrder] = useState(faq?.sort_order || 0);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(faq?.tags || []);
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const isEdit = !!faq;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = showCustomCategory && customCategory.trim() ? customCategory.trim() : category;
    onSave({
      ...(faq ? { id: faq.id } : {}),
      question: question.trim(),
      answer: answer.trim(),
      category: finalCategory,
      target_audience: audience,
      is_published: published,
      sort_order: sortOrder,
      tags,
    });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 mx-4"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-8 py-5 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                {isEdit ? (
                  <Pencil className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Plus className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEdit ? "Edit FAQ" : "Create New FAQ"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEdit
                    ? "Modify the question and answer below"
                    : "Add a new entry to the knowledge base"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              Question
            </label>
            <Input
              id="faq-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How do I file a complaint?"
              required
              className="!h-11"
            />
          </div>

          {/* Answer */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              Answer
            </label>
            <Textarea
              id="faq-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a clear, comprehensive answer..."
              required
              rows={5}
            />
          </div>

          {/* Category & Audience Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                Category
              </label>
              {!showCustomCategory ? (
                <div className="space-y-2">
                  <select
                    id="faq-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomCategory(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Custom category
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomCategory(false);
                      setCustomCategory("");
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    ← Use preset category
                  </button>
                </div>
              )}
            </div>

            {/* Audience */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                Target Audience
              </label>
              <div className="flex gap-2">
                {(Object.keys(AUDIENCE_CONFIG) as Array<keyof typeof AUDIENCE_CONFIG>).map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAudience(key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        audience === key
                          ? AUDIENCE_CONFIG[key].color + " ring-2 ring-offset-1 ring-indigo-300"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {AUDIENCE_CONFIG[key].label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              Tags
            </label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sort Order & Published */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                Sort Order
              </label>
              <Input
                id="faq-sort-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Visibility</label>
              <button
                type="button"
                onClick={() => setPublished(!published)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  published
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {published ? "Published" : "Draft"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!question.trim() || !answer.trim()}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isEdit ? "Update FAQ" : "Create FAQ"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── Delete Confirmation ─────────────────────────── */

function DeleteConfirmModal({
  faq,
  onConfirm,
  onClose,
}: {
  faq: FAQ;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 mx-4"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Delete FAQ?</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              This will permanently remove &ldquo;
              <span className="font-medium text-slate-700">{faq.question.slice(0, 60)}{faq.question.length > 60 ? "..." : ""}</span>
              &rdquo; from the knowledge base. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── FAQ Card ─────────────────────────── */

function FAQCard({
  faq,
  onEdit,
  onDelete,
  onTogglePublish,
  viewMode,
}: {
  faq: FAQ;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  viewMode: ViewMode;
}) {
  const [expanded, setExpanded] = useState(false);

  const audienceConfig = AUDIENCE_CONFIG[faq.target_audience];

  if (viewMode === "grid") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300 overflow-hidden flex flex-col"
      >
        {/* Color bar */}
        <div
          className={`h-1 w-full ${
            faq.is_published
              ? "bg-gradient-to-r from-emerald-400 to-teal-400"
              : "bg-gradient-to-r from-slate-300 to-slate-200"
          }`}
        />

        <div className="p-5 flex flex-col flex-1">
          {/* Top badges row */}
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${audienceConfig.color}`}>
              {audienceConfig.label}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                faq.is_published
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {faq.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {faq.is_published ? "Live" : "Draft"}
            </span>
          </div>

          {/* Question */}
          <h4 className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-3">
            {faq.question}
          </h4>

          {/* Answer preview */}
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-auto">
            {faq.answer}
          </p>

          {/* Tags */}
          {faq.tags && faq.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {faq.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-medium border border-slate-100"
                >
                  {tag}
                </span>
              ))}
              {faq.tags.length > 3 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  +{faq.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onTogglePublish}
              title={faq.is_published ? "Unpublish" : "Publish"}
            >
              {faq.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onDelete}
              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-300 overflow-hidden"
    >
      <div className="flex items-start gap-4 p-5">
        {/* Grip */}
        <div className="pt-0.5 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-start gap-2 text-left min-w-0 flex-1"
            >
              <motion.div
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="mt-0.5 shrink-0"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </motion.div>
              <h4 className="text-sm font-semibold text-slate-800 leading-snug">{faq.question}</h4>
            </button>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${audienceConfig.color}`}>
                {audienceConfig.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  faq.is_published
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {faq.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {faq.is_published ? "Live" : "Draft"}
              </span>
            </div>
          </div>

          {/* Expanded answer */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 ml-6 pl-4 border-l-2 border-indigo-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {faq.answer}
                  </p>
                  {faq.tags && faq.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {faq.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-semibold border border-indigo-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-3">
                    Sort order: {faq.sort_order} · Updated: {formatAppDate(faq.updated_at)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onTogglePublish}
            title={faq.is_published ? "Unpublish" : "Publish"}
          >
            {faq.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Category Section ─────────────────────────── */

function CategorySection({
  category,
  faqs,
  onEdit,
  onDelete,
  onTogglePublish,
  viewMode,
}: {
  category: string;
  faqs: FAQ[];
  onEdit: (faq: FAQ) => void;
  onDelete: (faq: FAQ) => void;
  onTogglePublish: (faq: FAQ) => void;
  viewMode: ViewMode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const publishedCount = faqs.filter((f) => f.is_published).length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full text-left group"
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </motion.div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          {category}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
            {faqs.length} {faqs.length === 1 ? "item" : "items"}
          </span>
          <span className="text-[10px] text-emerald-500 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
            {publishedCount} live
          </span>
        </div>
        <div className="flex-1 border-t border-dashed border-slate-200 ml-2" />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-2"
              }
            >
              {faqs.map((faq) => (
                <FAQCard
                  key={faq.id}
                  faq={faq}
                  onEdit={() => onEdit(faq)}
                  onDelete={() => onDelete(faq)}
                  onTogglePublish={() => onTogglePublish(faq)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────── Stats Bar ─────────────────────────── */

function StatsBar({ faqs }: { faqs: FAQ[] }) {
  const total = faqs.length;
  const published = faqs.filter((f) => f.is_published).length;
  const drafts = total - published;
  const categories = new Set(faqs.map((f) => f.category)).size;

  const stats = [
    { label: "Total FAQs", value: total, color: "text-indigo-600", bgColor: "bg-indigo-50" },
    { label: "Published", value: published, color: "text-emerald-600", bgColor: "bg-emerald-50" },
    { label: "Drafts", value: drafts, color: "text-amber-600", bgColor: "bg-amber-50" },
    { label: "Categories", value: categories, color: "text-violet-600", bgColor: "bg-violet-50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bgColor} rounded-xl px-4 py-3 flex items-center gap-3 border border-transparent`}
        >
          <span className={`text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</span>
          <span className="text-xs font-medium text-slate-600">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */

export default function AdminFAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingFaq, setEditingFaq] = useState<FAQ | null | undefined>(undefined); // undefined = closed, null = new, FAQ = edit
  const [deletingFaq, setDeletingFaq] = useState<FAQ | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch FAQs
  const fetchFAQs = useCallback(async () => {
    try {
      const res = await fetch("/api/faqs");
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        setFaqs(json.data);
      } else {
        // Use demo data as fallback when no FAQs exist in DB yet
        setFaqs(DEMO_FAQS);
      }
    } catch {
      // Fallback to demo data on API failure
      setFaqs(DEMO_FAQS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFAQs();
  }, [fetchFAQs]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesSearch =
        !search ||
        faq.question.toLowerCase().includes(search.toLowerCase()) ||
        faq.answer.toLowerCase().includes(search.toLowerCase()) ||
        faq.tags?.some((t) => t.includes(search.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || faq.category === categoryFilter;
      const matchesAudience = audienceFilter === "all" || faq.target_audience === audienceFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && faq.is_published) ||
        (statusFilter === "draft" && !faq.is_published);
      return matchesSearch && matchesCategory && matchesAudience && matchesStatus;
    });
  }, [faqs, search, categoryFilter, audienceFilter, statusFilter]);

  const groupedFaqs = useMemo(() => groupByCategory(filteredFaqs), [filteredFaqs]);
  const categories = useMemo(() => [...new Set(faqs.map((f) => f.category))].sort(), [faqs]);

  // CRUD Handlers
  const handleSave = async (data: Partial<FAQ>) => {
    const isEdit = !!data.id;
    try {
      const res = await fetch("/api/faqs", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setEditingFaq(undefined);
      fetchFAQs();
      showToast(isEdit ? "FAQ updated successfully" : "FAQ created successfully", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to save FAQ",
        "error"
      );
    }
  };

  const handleDelete = async () => {
    if (!deletingFaq) return;
    try {
      const res = await fetch(`/api/faqs?id=${deletingFaq.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setDeletingFaq(null);
      fetchFAQs();
      showToast("FAQ deleted successfully", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete FAQ",
        "error"
      );
    }
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      const res = await fetch("/api/faqs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: faq.id, is_published: !faq.is_published }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      fetchFAQs();
      showToast(
        faq.is_published ? "FAQ unpublished" : "FAQ published",
        "success"
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to update FAQ",
        "error"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-900">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Header ── */}
        <header className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                FAQ Knowledge Base
              </h1>
              <p className="text-sm text-slate-500">
                Manage frequently asked questions across your organization
              </p>
            </div>
          </div>
        </header>

        {/* ── Stats ── */}
        <StatsBar faqs={faqs} />

        {/* ── Toolbar ── */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Top row: Search + Create */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="faq-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, answers, or tags..."
                className="!pl-10 !h-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              onClick={() => setEditingFaq(null)}
              className="gap-2 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-md shadow-indigo-200/50"
            >
              <Plus className="w-4 h-4" />
              Create FAQ
            </Button>
          </div>

          {/* Bottom row: Filters + View toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="faq-filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Audience filter */}
            <select
              id="faq-filter-audience"
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Audiences</option>
              <option value="patient">Patient</option>
              <option value="staff">Staff</option>
              <option value="all">Everyone</option>
            </select>

            {/* Status filter */}
            <select
              id="faq-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>

            <div className="flex-1" />

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Result count */}
            <span className="text-xs text-slate-400 font-medium">
              {filteredFaqs.length} result{filteredFaqs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 bg-slate-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {faqs.length === 0 ? "No FAQs yet" : "No matches found"}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {faqs.length === 0
                ? "Start building your knowledge base by creating your first FAQ entry."
                : "Try adjusting your search or filters to find what you're looking for."}
            </p>
            {faqs.length === 0 && (
              <Button
                onClick={() => setEditingFaq(null)}
                className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600"
              >
                <Plus className="w-4 h-4" />
                Create First FAQ
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedFaqs).map(([category, catFaqs]) => (
              <CategorySection
                key={category}
                category={category}
                faqs={catFaqs}
                onEdit={(faq) => setEditingFaq(faq)}
                onDelete={(faq) => setDeletingFaq(faq)}
                onTogglePublish={handleTogglePublish}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {editingFaq !== undefined && (
          <FAQFormModal
            faq={editingFaq}
            onSave={handleSave}
            onClose={() => setEditingFaq(undefined)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingFaq && (
          <DeleteConfirmModal
            faq={deletingFaq}
            onConfirm={handleDelete}
            onClose={() => setDeletingFaq(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
