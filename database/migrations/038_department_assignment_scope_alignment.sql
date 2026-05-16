-- Migration 038: Department assignment scope alignment
-- Tightens the legacy users.department_id fallback so it is only used for
-- accounts that have not yet been migrated into user_department_assignments.

CREATE OR REPLACE FUNCTION public.get_active_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH active_assignment_set AS (
        SELECT COALESCE(public.get_active_staff_departments(), ARRAY[]::UUID[]) AS department_ids
    ),
    assignment_count AS (
        SELECT COUNT(*)::INTEGER AS total_assignments
        FROM public.user_department_assignments uda
        INNER JOIN public.users u ON u.id = uda.user_id
        WHERE u.auth_user_id = auth.uid()
          AND u.deleted_at IS NULL
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
            WHEN ac.total_assignments = 0
                 AND lp.department_id IS NOT NULL
                THEN lp.department_id
            ELSE NULL
        END
    FROM active_assignment_set a
    CROSS JOIN assignment_count ac
    CROSS JOIN requested_header rh
    CROSS JOIN legacy_profile lp;
$$;

COMMENT ON FUNCTION public.get_active_department_id() IS
    'Returns the validated active department for this request. Prefers X-Active-Dept-Id, then a single active assignment, then legacy users.department_id only when no M2M assignment rows exist.';
