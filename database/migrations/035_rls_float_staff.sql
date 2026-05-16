-- Migration 035: RLS Float Staff Policy Updates
-- Updates complaint, PHI, status history, and on_call policies to support
-- float staff MANY-to-MANY department assignments.
--
-- Key change: replaces single-value get_my_department_id() comparisons with
-- array-based get_active_staff_departments() checks using = ANY(...).
-- This resolves the N+1 problem — the array is computed ONCE per query, not per row.
--
-- Run AFTER:
--   030_user_department_assignments.sql
--   034_rls_helpers_v2.sql

-- =============================================================================
-- COMPLAINTS — update department_manager branch
-- =============================================================================

DROP POLICY IF EXISTS complaints_select ON public.complaints;

CREATE POLICY complaints_select ON public.complaints
    FOR SELECT TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'patient' THEN
                patient_id = auth.uid() AND deleted_at IS NULL

            WHEN 'department_manager' THEN
                -- Float staff: active session dept must be in their M2M assignment list
                -- Pre-assigned staff: their single dept resolves via get_active_staff_departments() too
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
                AND department_id = ANY(public.get_active_staff_departments())

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

-- =============================================================================
-- COMPLAINT_PHI — update department_manager branch
-- =============================================================================

DROP POLICY IF EXISTS complaint_phi_select ON public.complaint_phi;

CREATE POLICY complaint_phi_select ON public.complaint_phi
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_phi.complaint_id
              AND c.deleted_at IS NULL
              AND (
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR
                  -- Float staff: any of their assigned depts; resolved once via array
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = ANY(public.get_active_staff_departments())
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'quality_coordinator'
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'dpo')
              )
        )
    );

-- =============================================================================
-- COMPLAINT_STATUS_HISTORY — update department_manager branch
-- =============================================================================

DROP POLICY IF EXISTS status_history_select ON public.complaint_status_history;

CREATE POLICY status_history_select ON public.complaint_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_status_history.complaint_id
              AND (
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR (public.get_my_role() = 'department_manager'
                      AND c.department_id = ANY(public.get_active_staff_departments())
                      AND c.hospital_id = public.get_my_hospital_id())
                  OR (public.get_my_role() IN ('quality_coordinator', 'admin', 'medical_superintendent')
                      AND c.hospital_id = public.get_my_hospital_id())
                  OR (public.get_my_role() = 'dpo')
              )
        )
    );

-- =============================================================================
-- ON_CALL_SCHEDULES — update insert/update to check M2M assignments
-- =============================================================================

DROP POLICY IF EXISTS on_call_insert ON public.on_call_schedules;
DROP POLICY IF EXISTS on_call_update ON public.on_call_schedules;

CREATE POLICY on_call_insert ON public.on_call_schedules
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        -- department_manager can only schedule in their own assigned departments
        AND (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            OR department_id = ANY(public.get_active_staff_departments())
        )
    );

CREATE POLICY on_call_update ON public.on_call_schedules
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        AND (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            OR department_id = ANY(public.get_active_staff_departments())
        )
    );

-- =============================================================================
-- USER_DEPARTMENT_ASSIGNMENTS — RLS already applied in migration 030
-- No changes needed here; policies are hospital-scoped to admin/med_supt only.
-- =============================================================================

-- =============================================================================
-- STAFF_SESSION_CONTEXT — RLS already applied in migration 031
-- =============================================================================

-- =============================================================================
-- WEBAUTHN_CREDENTIALS — RLS already applied in migration 032
-- =============================================================================

COMMENT ON POLICY complaints_select ON public.complaints IS
    'Updated in 035: department_manager branch now uses get_active_staff_departments() '
    'array check instead of single get_my_department_id() to support float staff M2M assignments.';
