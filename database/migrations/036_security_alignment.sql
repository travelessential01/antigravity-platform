-- Migration 036: Security alignment
-- Aligns app/runtime auth helpers with the DB source of truth, tightens
-- department-scoped RLS, and brings notifications into line with the
-- acknowledgment workflow used by the application code.

-- =============================================================================
-- NOTIFICATIONS SCHEMA ALIGNMENT
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE public.notifications RENAME COLUMN user_id TO recipient_id;
    END IF;
END $$;

ALTER TABLE public.notifications
    ALTER COLUMN channel SET DEFAULT 'in_app';

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS deep_link TEXT;

UPDATE public.notifications
SET channel = 'in_app'
WHERE channel IS NULL OR channel = '';

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_status_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'expired'));

DROP INDEX IF EXISTS idx_notifications_user_id;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
    ON public.notifications (recipient_id, created_at DESC);

COMMENT ON TABLE public.notifications IS
    'Zero-PHI notification records. secure_link_id + deep_link support signed acknowledgement links.';

-- =============================================================================
-- DB-BACKED AUTH HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_user_id() IS
    'Returns public.users.id for auth.uid(). DB-backed source of truth for user-scoped RLS.';

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.role
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_hospital_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.hospital_id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_active_staff_departments()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ARRAY(
        SELECT uda.department_id
        FROM public.user_department_assignments uda
        INNER JOIN public.users u ON u.id = uda.user_id
        WHERE u.auth_user_id = auth.uid()
          AND u.deleted_at IS NULL
          AND uda.is_active = TRUE
          AND (uda.valid_until IS NULL OR uda.valid_until > now())
    );
$$;

COMMENT ON FUNCTION public.get_active_staff_departments() IS
    'Returns UUID[] of all active department assignments for the authenticated staff member.';

CREATE OR REPLACE FUNCTION public.get_active_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH assignment_set AS (
        SELECT COALESCE(public.get_active_staff_departments(), ARRAY[]::UUID[]) AS department_ids
    ),
    requested_header AS (
        SELECT NULLIF(
            (current_setting('request.headers', true)::jsonb ->> 'x-active-dept-id'),
            ''
        )::UUID AS department_id
    ),
    legacy_profile AS (
        SELECT u.department_id
        FROM public.users u
        WHERE u.auth_user_id = auth.uid()
          AND u.deleted_at IS NULL
        LIMIT 1
    )
    SELECT
        CASE
            WHEN rh.department_id IS NOT NULL
                 AND rh.department_id = ANY(a.department_ids)
                THEN rh.department_id
            WHEN COALESCE(array_length(a.department_ids, 1), 0) = 1
                THEN a.department_ids[1]
            WHEN lp.department_id IS NOT NULL
                 AND (
                    COALESCE(array_length(a.department_ids, 1), 0) = 0
                    OR lp.department_id = ANY(a.department_ids)
                 )
                THEN lp.department_id
            ELSE NULL
        END
    FROM assignment_set a
    CROSS JOIN requested_header rh
    CROSS JOIN legacy_profile lp;
$$;

COMMENT ON FUNCTION public.get_active_department_id() IS
    'Returns the validated active department for this request. Prefers X-Active-Dept-Id, then single active assignment, then legacy users.department_id fallback.';

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT public.get_active_department_id();
$$;

COMMENT ON FUNCTION public.get_my_department_id() IS
    'Deprecated alias for get_active_department_id().';

-- =============================================================================
-- RLS POLICY ALIGNMENT
-- =============================================================================

DROP POLICY IF EXISTS uda_select ON public.user_department_assignments;
CREATE POLICY uda_select ON public.user_department_assignments
    FOR SELECT TO authenticated
    USING (
        user_id = public.get_my_user_id()
        OR (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            AND hospital_id = public.get_my_hospital_id()
        )
    );

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
    FOR SELECT TO authenticated
    USING (recipient_id = public.get_my_user_id());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE TO authenticated
    USING (recipient_id = public.get_my_user_id())
    WITH CHECK (recipient_id = public.get_my_user_id());

DROP POLICY IF EXISTS complaints_select ON public.complaints;
CREATE POLICY complaints_select ON public.complaints
    FOR SELECT TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'patient' THEN
                patient_id = auth.uid() AND deleted_at IS NULL
            WHEN 'department_manager' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
                AND department_id = public.get_active_department_id()
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
                deleted_at IS NULL
            ELSE false
        END
    );

DROP POLICY IF EXISTS complaints_update ON public.complaints;
CREATE POLICY complaints_update ON public.complaints
    FOR UPDATE TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'department_manager' THEN
                hospital_id = public.get_my_hospital_id()
                AND department_id = public.get_active_department_id()
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
            ELSE false
        END
    )
    WITH CHECK (
        CASE public.get_my_role()
            WHEN 'department_manager' THEN
                hospital_id = public.get_my_hospital_id()
                AND department_id = public.get_active_department_id()
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
            ELSE false
        END
    );

DROP POLICY IF EXISTS complaint_phi_select ON public.complaint_phi;
CREATE POLICY complaint_phi_select ON public.complaint_phi
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.complaints c
            WHERE c.id = complaint_phi.complaint_id
              AND c.deleted_at IS NULL
              AND (
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = public.get_active_department_id()
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'quality_coordinator'
                   AND c.hospital_id = public.get_my_hospital_id())
              )
        )
    );

DROP POLICY IF EXISTS status_history_select ON public.complaint_status_history;
CREATE POLICY status_history_select ON public.complaint_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.complaints c
            WHERE c.id = complaint_status_history.complaint_id
              AND (
                  (public.get_my_role() = 'patient' AND c.patient_id = auth.uid())
                  OR
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = public.get_active_department_id()
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() IN ('quality_coordinator', 'admin', 'medical_superintendent')
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'dpo')
              )
        )
    );

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
                department_id = public.get_active_department_id()
                AND hospital_id = public.get_my_hospital_id()
        END
    );

DROP POLICY IF EXISTS on_call_insert ON public.on_call_schedules;
CREATE POLICY on_call_insert ON public.on_call_schedules
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        AND (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            OR department_id = public.get_active_department_id()
        )
    );

DROP POLICY IF EXISTS on_call_update ON public.on_call_schedules;
CREATE POLICY on_call_update ON public.on_call_schedules
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        AND (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            OR department_id = public.get_active_department_id()
        )
    )
    WITH CHECK (
        public.get_my_role() IN ('admin', 'department_manager', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
        AND (
            public.get_my_role() IN ('admin', 'medical_superintendent')
            OR department_id = public.get_active_department_id()
        )
    );

DROP POLICY IF EXISTS "Admins full access to FAQs" ON public.faqs;
CREATE POLICY faqs_staff_manage ON public.faqs
    FOR ALL TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'quality_coordinator', 'medical_superintendent')
    )
    WITH CHECK (
        public.get_my_role() IN ('admin', 'quality_coordinator', 'medical_superintendent')
    );
