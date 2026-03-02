-- Migration 012: Create notifications table
-- Zero PHI — only secure_link_id is transmitted across channels
-- Deep-link: JWT-signed, single-use, 15-min TTL

CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id),
    complaint_id    UUID NOT NULL REFERENCES public.complaints(id),
    channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'in_app')),
    secure_link_id  UUID UNIQUE DEFAULT gen_random_uuid(),   -- deep-link token
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'sent', 'delivered', 'read', 'failed'
                    )),
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_complaint_id ON public.notifications (complaint_id);
CREATE INDEX idx_notifications_secure_link ON public.notifications (secure_link_id);

COMMENT ON TABLE public.notifications IS 'Zero-PHI notification records. Only secure_link_id transmitted. Deep-link resolves within authenticated session.';
