-- Migration: Sprint 3 SLA Breach Logging & Deep-Link Notifications

-- 1. Create the Notification table for 15-Minute Escalation Deep-Links
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL, -- The user/manager receiving the alert
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    deep_link TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unread', -- 'Unread', 'Read', 'Expired'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Note: We rely on the established RLS policies to restrict read access.
-- Using SERVICE_ROLE in Edge functions to write these.

-- 2. Create the immutable SLA Breach logging ledger
CREATE TABLE IF NOT EXISTS public.sla_breach_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    escalation_level TEXT NOT NULL, -- 'primary', 'secondary'
    active_manager_id UUID, -- Snapshot of who was theoretically on-call
    breach_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    clinical_sla_threshold_minutes INT NOT NULL,
    metadata JSONB
);

-- Force immutability: Revoke all UPDATE/DELETE rights from everyone on the ledger
REVOKE UPDATE, DELETE ON public.sla_breach_log FROM authenticated, anon, service_role;
