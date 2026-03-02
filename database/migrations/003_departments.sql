-- Migration 003: Create departments table
-- Each department belongs to a hospital and has an escalation_level

CREATE TABLE IF NOT EXISTS public.departments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID NOT NULL REFERENCES public.hospitals(id),
    name                TEXT NOT NULL,
    escalation_level    INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_departments_hospital_id ON public.departments(hospital_id);

COMMENT ON TABLE public.departments IS 'Hospital departments with escalation_level for SLA routing. FK to hospitals.';
