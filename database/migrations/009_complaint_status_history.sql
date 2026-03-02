-- Migration 009: Create complaint_status_history table (IMMUTABLE)
-- Every status transition is recorded here via trigger (created in Task 1.4)
-- No UPDATE or DELETE permitted — compliance-grade immutability

CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID NOT NULL REFERENCES public.complaints(id),
    previous_status TEXT,
    new_status      TEXT NOT NULL,
    changed_by      UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    -- No deleted_at: immutable table, no soft-deletes
);

CREATE INDEX idx_status_history_complaint_id
    ON public.complaint_status_history (complaint_id, created_at);

-- IMMUTABILITY: Revoke UPDATE and DELETE from all application roles
-- The postgres superuser retains privileges for emergency DR only
REVOKE UPDATE, DELETE ON public.complaint_status_history FROM anon, authenticated, service_role;

COMMENT ON TABLE public.complaint_status_history IS 'IMMUTABLE status transition log. No UPDATE/DELETE permitted. Trigger-populated on every status change.';
