-- Migration 045: Complaint severity history
-- Immutable, zero-PHI audit trail for automatic triage decisions and staff overrides.

CREATE TABLE IF NOT EXISTS public.complaint_severity_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id        UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    previous_severity   TEXT CHECK (previous_severity IN ('critical', 'high', 'medium', 'low')),
    new_severity        TEXT NOT NULL CHECK (new_severity IN ('critical', 'high', 'medium', 'low')),
    decision_source     TEXT NOT NULL CHECK (decision_source IN (
                            'auto_triage',
                            'duplicate_auto_raise',
                            'staff_override'
                        )),
    reason_codes        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    override_reason     TEXT,
    changed_by          UUID REFERENCES public.users(id),
    metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_override_reason_required CHECK (
        decision_source <> 'staff_override'
        OR length(btrim(COALESCE(override_reason, ''))) >= 5
    )
);

CREATE INDEX IF NOT EXISTS idx_complaint_severity_history_complaint
    ON public.complaint_severity_history (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_severity_history_changed_by
    ON public.complaint_severity_history (changed_by, created_at DESC)
    WHERE changed_by IS NOT NULL;

ALTER TABLE public.complaint_severity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_severity_history FORCE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON public.complaint_severity_history
    FROM anon, authenticated, service_role;

DROP POLICY IF EXISTS complaint_severity_history_select ON public.complaint_severity_history;
CREATE POLICY complaint_severity_history_select ON public.complaint_severity_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.complaints c
            WHERE c.id = complaint_severity_history.complaint_id
              AND c.deleted_at IS NULL
              AND (
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

DROP POLICY IF EXISTS complaint_severity_history_insert_service ON public.complaint_severity_history;
CREATE POLICY complaint_severity_history_insert_service ON public.complaint_severity_history
    FOR INSERT TO service_role
    WITH CHECK (true);

COMMENT ON TABLE public.complaint_severity_history IS
    'Immutable zero-PHI severity decision history for SLA triage and staff overrides.';

COMMENT ON COLUMN public.complaint_severity_history.metadata IS
    'Non-PHI structured triage metadata and operational context only. Do not store complaint description or reporter identifiers.';
