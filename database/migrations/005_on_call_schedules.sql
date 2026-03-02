-- Migration 005: Create on_call_schedules table
-- Shift-aware routing backbone for SLA escalation
-- Partial unique index ensures only one primary on-call per department per shift

CREATE TABLE IF NOT EXISTS public.on_call_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID NOT NULL REFERENCES public.hospitals(id),
    department_id       UUID NOT NULL REFERENCES public.departments(id),
    user_id             UUID NOT NULL REFERENCES public.users(id),
    shift_start         TIMESTAMPTZ NOT NULL,
    shift_end           TIMESTAMPTZ NOT NULL,
    is_primary_on_call  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT chk_shift_order CHECK (shift_end > shift_start)
);

-- Only one primary on-call per department per shift start time
CREATE UNIQUE INDEX idx_on_call_primary_unique
    ON public.on_call_schedules (department_id, shift_start)
    WHERE is_primary_on_call = TRUE AND deleted_at IS NULL;

-- Composite index for O(1) escalation routing lookups
CREATE INDEX idx_on_call_dept_shift
    ON public.on_call_schedules (department_id, shift_start, shift_end);

COMMENT ON TABLE public.on_call_schedules IS 'Shift-aware routing for SLA escalation. Partial unique index enforces one primary on-call per dept/shift.';
