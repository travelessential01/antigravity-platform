-- Migration 017: Row Level Security (RLS)
-- Enable RLS on all 15 public tables and create role-based policies
-- JWT custom claims: role, hospital_id, department_id extracted via auth.jwt()

-- =============================================================
-- HELPER FUNCTION: Extract custom claims from JWT
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_my_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT coalesce(
        (current_setting('request.jwt.claims', true)::jsonb ->> claim),
        ''
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT public.get_my_claim('role');
$$;

CREATE OR REPLACE FUNCTION public.get_my_hospital_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(public.get_my_claim('hospital_id'), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(public.get_my_claim('department_id'), '')::UUID;
$$;

-- =============================================================
-- ENABLE RLS ON ALL 15 TABLES
-- =============================================================
ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_call_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_configurations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_phi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_breach_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents       ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- FORCE RLS for table owners too (prevents bypass via ownership)
-- =============================================================
ALTER TABLE public.organizations          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.departments            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.on_call_schedules      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sla_configurations     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.complaints             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_phi          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sla_breach_log         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents       FORCE ROW LEVEL SECURITY;

-- =============================================================
-- POLICIES: organizations (read-only for all authenticated)
-- =============================================================
CREATE POLICY organizations_select ON public.organizations
    FOR SELECT TO authenticated
    USING (true);

-- =============================================================
-- POLICIES: hospitals (scoped to user's hospital)
-- =============================================================
CREATE POLICY hospitals_select ON public.hospitals
    FOR SELECT TO authenticated
    USING (id = public.get_my_hospital_id() OR public.get_my_role() IN ('admin', 'dpo', 'medical_superintendent'));

-- =============================================================
-- POLICIES: departments (scoped to user's hospital)
-- =============================================================
CREATE POLICY departments_select ON public.departments
    FOR SELECT TO authenticated
    USING (hospital_id = public.get_my_hospital_id());

-- =============================================================
-- POLICIES: users
-- =============================================================
-- All authenticated can see users in their hospital
CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated
    USING (
        hospital_id = public.get_my_hospital_id()
        AND deleted_at IS NULL
    );

-- Only admins can insert/update users
CREATE POLICY users_insert ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() IN ('admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

CREATE POLICY users_update ON public.users
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

-- =============================================================
-- POLICIES: on_call_schedules
-- =============================================================
CREATE POLICY on_call_select ON public.on_call_schedules
    FOR SELECT TO authenticated
    USING (hospital_id = public.get_my_hospital_id());

CREATE POLICY on_call_insert ON public.on_call_schedules
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

CREATE POLICY on_call_update ON public.on_call_schedules
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

-- =============================================================
-- POLICIES: sla_configurations
-- =============================================================
CREATE POLICY sla_config_select ON public.sla_configurations
    FOR SELECT TO authenticated
    USING (hospital_id = public.get_my_hospital_id());

CREATE POLICY sla_config_manage ON public.sla_configurations
    FOR ALL TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

-- =============================================================
-- POLICIES: complaints (THE CORE — role-tiered access)
-- =============================================================

-- Patients see only their own complaints
-- Dept managers see complaints in their department
-- Quality/Admin/Med Supt see all in their hospital
-- DPO sees all (cross-hospital for auditing)
CREATE POLICY complaints_select ON public.complaints
    FOR SELECT TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'patient' THEN
                patient_id = auth.uid() AND deleted_at IS NULL
            WHEN 'department_manager' THEN
                department_id = public.get_my_department_id()
                AND hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'quality_coordinator' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'admin' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'medical_superintendent' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'dpo' THEN
                deleted_at IS NULL  -- DPO: full cross-hospital audit access
            ELSE false
        END
    );

-- Patients can create complaints
CREATE POLICY complaints_insert_patient ON public.complaints
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() = 'patient'
        AND patient_id = auth.uid()
    );

-- Staff can update complaints (status, assignment) in their scope
CREATE POLICY complaints_update ON public.complaints
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('department_manager', 'quality_coordinator', 'admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        AND deleted_at IS NULL
    );

-- =============================================================
-- POLICIES: complaint_phi (MOST RESTRICTIVE — PHI access)
-- =============================================================

-- Only dept managers (own dept), quality coordinators, and DPO can read PHI
-- Patient can read their own PHI via complaint linkage
CREATE POLICY complaint_phi_select ON public.complaint_phi
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_phi.complaint_id
              AND c.deleted_at IS NULL
              AND (
                  -- Patient: own complaints only
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR
                  -- Dept manager: own department only
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = public.get_my_department_id()
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  -- Quality coordinator: entire hospital
                  (public.get_my_role() = 'quality_coordinator'
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  -- DPO: cross-hospital audit access
                  (public.get_my_role() = 'dpo')
              )
        )
    );

-- Only patients can insert PHI (at intake)
CREATE POLICY complaint_phi_insert ON public.complaint_phi
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_phi.complaint_id
              AND c.patient_id = auth.uid()
              AND public.get_my_role() = 'patient'
        )
    );

-- =============================================================
-- POLICIES: complaint_status_history (read-only, scoped)
-- =============================================================
CREATE POLICY status_history_select ON public.complaint_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_status_history.complaint_id
              AND (
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR (public.get_my_role() = 'department_manager'
                      AND c.department_id = public.get_my_department_id()
                      AND c.hospital_id = public.get_my_hospital_id())
                  OR (public.get_my_role() IN ('quality_coordinator', 'admin', 'medical_superintendent')
                      AND c.hospital_id = public.get_my_hospital_id())
                  OR (public.get_my_role() = 'dpo')
              )
        )
    );

-- Insert is trigger-only (via status change trigger in Task 1.4)
-- service_role bypasses RLS for trigger inserts
CREATE POLICY status_history_insert ON public.complaint_status_history
    FOR INSERT TO service_role
    WITH CHECK (true);

-- =============================================================
-- POLICIES: audit_logs (DPO + admin read-only, service_role write)
-- =============================================================
CREATE POLICY audit_logs_select ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.get_my_role() IN ('dpo', 'admin', 'medical_superintendent')
    );

-- Only service_role (triggers) can insert
CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT TO service_role
    WITH CHECK (true);

-- =============================================================
-- POLICIES: processed_events (service_role only)
-- =============================================================
CREATE POLICY processed_events_all ON public.processed_events
    FOR ALL TO service_role
    USING (true);

-- =============================================================
-- POLICIES: notifications (user sees own notifications)
-- =============================================================
CREATE POLICY notifications_select ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- service_role creates notifications
CREATE POLICY notifications_insert ON public.notifications
    FOR INSERT TO service_role
    WITH CHECK (true);

-- User can update (mark as read)
CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- =============================================================
-- POLICIES: sla_breach_log (admin/quality/dpo read, service_role write)
-- =============================================================
CREATE POLICY sla_breach_select ON public.sla_breach_log
    FOR SELECT TO authenticated
    USING (
        public.get_my_role() IN ('quality_coordinator', 'admin', 'medical_superintendent', 'dpo')
    );

CREATE POLICY sla_breach_insert ON public.sla_breach_log
    FOR INSERT TO service_role
    WITH CHECK (true);

-- =============================================================
-- POLICIES: security_alerts (admin/dpo read, service_role write)
-- =============================================================
CREATE POLICY security_alerts_select ON public.security_alerts
    FOR SELECT TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'medical_superintendent', 'dpo')
    );

CREATE POLICY security_alerts_insert ON public.security_alerts
    FOR INSERT TO service_role
    WITH CHECK (true);

-- =============================================================
-- POLICIES: patient_consents (patient sees own, DPO sees all)
-- =============================================================
CREATE POLICY consents_select ON public.patient_consents
    FOR SELECT TO authenticated
    USING (
        (public.get_my_role() = 'patient' AND patient_id = auth.uid())
        OR public.get_my_role() = 'dpo'
    );

CREATE POLICY consents_insert ON public.patient_consents
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() = 'patient'
        AND patient_id = auth.uid()
    );
