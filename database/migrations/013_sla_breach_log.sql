-- Migration 013: Create sla_breach_log table
-- Every SLA breach event is recorded for JCI audit trail
-- Records breached_stage, escalation target, and timestamps

CREATE TABLE IF NOT EXISTS public.sla_breach_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id        UUID NOT NULL REFERENCES public.complaints(id),
    breached_stage      TEXT NOT NULL CHECK (breached_stage IN (
                            'acknowledgement', 'resolution'
                        )),
    breach_timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
    escalated_to        UUID REFERENCES public.users(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_breach_complaint_id ON public.sla_breach_log (complaint_id, breach_timestamp);

COMMENT ON TABLE public.sla_breach_log IS 'SLA breach events with escalation chain for JCI audit trail.';
