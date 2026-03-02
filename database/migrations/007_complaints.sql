-- Migration 007: Create complaints table
-- Workflow metadata only — NO PHI stored here
-- Status lifecycle: submitted → acknowledged → investigating → resolved → capa_validated → closed
-- parent_complaint_id self-FK supports duplicate merge

CREATE TABLE IF NOT EXISTS public.complaints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id             UUID NOT NULL REFERENCES public.hospitals(id),
    department_id           UUID NOT NULL REFERENCES public.departments(id),
    patient_id              UUID NOT NULL REFERENCES public.users(id),
    assigned_to             UUID REFERENCES public.users(id),
    parent_complaint_id     UUID REFERENCES public.complaints(id),  -- self-FK for duplicate merge
    status                  TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
                                'submitted',
                                'acknowledged',
                                'investigating',
                                'resolved',
                                'capa_validated',
                                'closed',
                                'escalated'
                            )),
    severity_level          TEXT CHECK (severity_level IN ('critical', 'high', 'medium', 'low')),
    sla_deadline            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ DEFAULT NULL
);

-- Primary query indexes for dashboard and SLA engine
CREATE INDEX idx_complaints_status_dept_created
    ON public.complaints (status, department_id, created_at, sla_deadline);

CREATE INDEX idx_complaints_patient_id
    ON public.complaints (patient_id);

CREATE INDEX idx_complaints_hospital_id
    ON public.complaints (hospital_id);

CREATE INDEX idx_complaints_parent
    ON public.complaints (parent_complaint_id)
    WHERE parent_complaint_id IS NOT NULL;

COMMENT ON TABLE public.complaints IS 'Workflow metadata ONLY — zero PHI. Status lifecycle enforced via CHECK. Self-FK for duplicate merge.';
