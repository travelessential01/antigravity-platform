-- Migration 030: user_department_assignments
-- Replaces the ONE-to-ONE users.department_id with a MANY-to-MANY junction table.
-- Supports both Pre-Assigned Staff (single 'primary' row) and Float Staff (multiple rows).

CREATE TABLE IF NOT EXISTS public.user_department_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    department_id   UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    hospital_id     UUID NOT NULL REFERENCES public.hospitals(id),
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'float', 'temporary')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until     TIMESTAMPTZ,            -- NULL = indefinite; float shifts use explicit window
    assigned_by     UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_valid_window CHECK (valid_until IS NULL OR valid_until > valid_from),
    UNIQUE (user_id, department_id)         -- one assignment record per user/dept pair
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Fast lookup: "get all currently-active departments for user X"
CREATE INDEX idx_uda_user_active
    ON public.user_department_assignments (user_id, is_active)
    WHERE is_active = TRUE;

-- Fast lookup: "get all currently-active staff in department Y"
CREATE INDEX idx_uda_dept_active
    ON public.user_department_assignments (department_id, hospital_id, is_active)
    WHERE is_active = TRUE;

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_department_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_department_assignments FORCE ROW LEVEL SECURITY;

-- Staff can read their own assignments; admins/managers can read all assignments in their hospital
CREATE POLICY uda_select ON public.user_department_assignments
    FOR SELECT TO authenticated
    USING (
        hospital_id = public.get_my_hospital_id()
    );

-- Only admins and medical_superintendent can insert / update assignments
CREATE POLICY uda_insert ON public.user_department_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_my_role() IN ('admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

CREATE POLICY uda_update ON public.user_department_assignments
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'medical_superintendent')
        AND hospital_id = public.get_my_hospital_id()
    );

COMMENT ON TABLE public.user_department_assignments IS
    'M2M junction between users and departments. assignment_type: primary (pre-assigned) | float | temporary. '
    'active session department is stored separately in staff_session_context, NOT in this table.';
