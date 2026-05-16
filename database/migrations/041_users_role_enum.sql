-- Migration 041: Convert public.users.role from free text + check constraint
-- into a first-class PostgreSQL enum so provisioning surfaces can present a
-- controlled role list instead of a plain text field.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'staff_role'
    ) THEN
        CREATE TYPE public.staff_role AS ENUM (
            'department_manager',
            'quality_coordinator',
            'admin',
            'medical_superintendent',
            'dpo'
        );
    END IF;
END $$;

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ALTER COLUMN role TYPE public.staff_role
    USING role::public.staff_role;

COMMENT ON TYPE public.staff_role IS
    'Canonical allowed staff roles for public.users.role. Backed by a PostgreSQL enum so admin tooling can offer a controlled list.';

COMMENT ON COLUMN public.users.role IS
    'Canonical staff role. Stored as public.staff_role enum.';

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.role::text
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.deleted_at IS NULL
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_role() IS
    'Returns the authenticated staff role from public.users as text for RLS helpers and policies.';
