-- Migration 006: Create sla_configurations table
-- Runtime SLA thresholds per hospital/department/severity
-- max_acknowledgement_hours <= 24h; max_resolution_hours <= 720h (30 days) per NABH PRE.7

CREATE TABLE IF NOT EXISTS public.sla_configurations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id                 UUID NOT NULL REFERENCES public.hospitals(id),
    department_id               UUID REFERENCES public.departments(id),  -- nullable = hospital-wide default
    severity_level              TEXT NOT NULL CHECK (severity_level IN ('critical', 'high', 'medium', 'low')),
    max_acknowledgement_hours   INTEGER NOT NULL CHECK (max_acknowledgement_hours > 0 AND max_acknowledgement_hours <= 24),
    max_resolution_hours        INTEGER NOT NULL CHECK (max_resolution_hours > 0 AND max_resolution_hours <= 720),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT uq_sla_config UNIQUE (hospital_id, department_id, severity_level)
);

COMMENT ON TABLE public.sla_configurations IS 'SLA thresholds per hospital/department/severity. Calendar hours (24/7). NABH PRE.7 ceilings enforced via CHECK.';
