-- Migration 034: RLS Helper Functions v2
-- Replaces the single-value get_my_department_id() with array-aware helpers
-- that support M2M float staff department assignments.
--
-- Call order in RLS policies:
--   get_my_hospital_id()              — unchanged, reads from JWT claim
--   get_active_department_id()        — reads X-Active-Dept-Id header (session context); JWT fallback
--   get_active_staff_departments()    — returns UUID[] of ALL active assignments for current user
--                                       (used with = ANY(...) to avoid N+1 per-row subqueries)

-- ── get_active_department_id() ─────────────────────────────────────────────────
-- Returns the single department the staff member is operating as THIS session.
-- Source priority:
--   1. X-Active-Dept-Id request header  (injected by Next.js middleware from staff_session_context)
--   2. JWT claim 'department_id'         (fallback for pre-assigned staff with no session context)

CREATE OR REPLACE FUNCTION public.get_active_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(
        COALESCE(
            -- Primary: dynamic session context injected by middleware
            (current_setting('request.headers', true)::jsonb ->> 'x-active-dept-id'),
            -- Fallback: JWT claim for pre-assigned staff (Authentik legacy → will be DB-sourced post-migration)
            public.get_my_claim('department_id')
        ),
        ''
    )::UUID;
$$;

COMMENT ON FUNCTION public.get_active_department_id() IS
    'Returns the active department UUID for the current request. '
    'Reads X-Active-Dept-Id header first (set by Next.js middleware from staff_session_context), '
    'then falls back to JWT department_id claim for pre-assigned staff. '
    'Replaces the old get_my_department_id() which was purely JWT-based.';

-- ── get_active_staff_departments() ────────────────────────────────────────────
-- Returns an ARRAY of all currently-active department UUIDs assigned to the calling user.
-- Evaluated ONCE per query, not per row — avoids N+1 when used as:
--   WHERE department_id = ANY(public.get_active_staff_departments())
--
-- For pre-assigned staff with only 1 assignment this returns a single-element array.
-- For float staff this returns all their assigned departments.

CREATE OR REPLACE FUNCTION public.get_active_staff_departments()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT ARRAY(
        SELECT uda.department_id
        FROM public.user_department_assignments uda
        INNER JOIN public.users u ON u.id = uda.user_id
        WHERE u.auth_user_id = auth.uid()
          AND uda.is_active = TRUE
          AND (uda.valid_until IS NULL OR uda.valid_until > now())
    );
$$;

COMMENT ON FUNCTION public.get_active_staff_departments() IS
    'Returns UUID[] of all currently-active department assignments for auth.uid(). '
    'Evaluated once per query; use with = ANY(...) in RLS policies to avoid N+1 scans. '
    'Returns empty array {} if user has no active assignments (access denied by default).';

-- ── Deprecation alias ─────────────────────────────────────────────────────────
-- Keep get_my_department_id() as a backward-compatible alias during transition.
-- Points to get_active_department_id() so existing policies still compile.
-- TARGET: remove this alias after 035_rls_float_staff.sql has been fully applied
-- and all callsites verified.

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT public.get_active_department_id();
$$;

COMMENT ON FUNCTION public.get_my_department_id() IS
    'DEPRECATED ALIAS — points to get_active_department_id(). '
    'Will be dropped after 035_rls_float_staff migration is confirmed stable.';
