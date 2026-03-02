-- Migration 019: RLS Compliance Gap Fixes
-- Fixes 4 gaps identified in Sprint 1 compliance audit

-- =============================================================
-- FIX 1: Remove DPO from complaint_phi SELECT policy
--        Directive: DPO reads audit_logs only, NOT PHI directly
-- =============================================================
DROP POLICY IF EXISTS complaint_phi_select ON public.complaint_phi;

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
                  -- DPO: REMOVED — per directive, DPO reads audit_logs only
                  -- Medical Superintendent: EXCLUDED — no PHI access per directive
                  -- Admin: EXCLUDED — no direct PHI access per directive
              )
        )
    );

-- =============================================================
-- FIX 2: Restrict on_call_schedules to department-scoped for non-admin
--        Directive: Users may only SELECT schedules for their own department_id
-- =============================================================
DROP POLICY IF EXISTS on_call_select ON public.on_call_schedules;

CREATE POLICY on_call_select ON public.on_call_schedules
    FOR SELECT TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'admin' THEN
                hospital_id = public.get_my_hospital_id()
            WHEN 'medical_superintendent' THEN
                hospital_id = public.get_my_hospital_id()
            ELSE
                -- All other roles: department-scoped only
                department_id = public.get_my_department_id()
                AND hospital_id = public.get_my_hospital_id()
        END
    );

-- =============================================================
-- FIX 3: Global REVOKE DELETE on all tables from authenticated role
--        Directive: No role may execute DELETE on any table
-- =============================================================
REVOKE DELETE ON public.organizations          FROM authenticated;
REVOKE DELETE ON public.hospitals              FROM authenticated;
REVOKE DELETE ON public.departments            FROM authenticated;
REVOKE DELETE ON public.users                  FROM authenticated;
REVOKE DELETE ON public.on_call_schedules      FROM authenticated;
REVOKE DELETE ON public.sla_configurations     FROM authenticated;
REVOKE DELETE ON public.complaints             FROM authenticated;
REVOKE DELETE ON public.complaint_phi          FROM authenticated;
REVOKE DELETE ON public.complaint_status_history FROM authenticated;
REVOKE DELETE ON public.audit_logs             FROM authenticated;
REVOKE DELETE ON public.processed_events       FROM authenticated;
REVOKE DELETE ON public.notifications          FROM authenticated;
REVOKE DELETE ON public.sla_breach_log         FROM authenticated;
REVOKE DELETE ON public.security_alerts        FROM authenticated;
REVOKE DELETE ON public.patient_consents       FROM authenticated;

-- Also revoke from anon
REVOKE DELETE ON public.organizations          FROM anon;
REVOKE DELETE ON public.hospitals              FROM anon;
REVOKE DELETE ON public.departments            FROM anon;
REVOKE DELETE ON public.users                  FROM anon;
REVOKE DELETE ON public.on_call_schedules      FROM anon;
REVOKE DELETE ON public.sla_configurations     FROM anon;
REVOKE DELETE ON public.complaints             FROM anon;
REVOKE DELETE ON public.complaint_phi          FROM anon;
REVOKE DELETE ON public.complaint_status_history FROM anon;
REVOKE DELETE ON public.audit_logs             FROM anon;
REVOKE DELETE ON public.processed_events       FROM anon;
REVOKE DELETE ON public.notifications          FROM anon;
REVOKE DELETE ON public.sla_breach_log         FROM anon;
REVOKE DELETE ON public.security_alerts        FROM anon;
REVOKE DELETE ON public.patient_consents       FROM anon;
