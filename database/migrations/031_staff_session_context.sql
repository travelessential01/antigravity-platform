-- Migration 031: staff_session_context
-- Stores the ACTIVE department context for a staff session.
-- Float staff select their active department at login; this record locks that choice
-- for the full 8-hour session. NO mid-session switching.
-- Middleware reads session_token cookie → resolves active_dept_id → injects X-Active-Dept-Id header.

CREATE TABLE IF NOT EXISTS public.staff_session_context (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    UUID NOT NULL,          -- mirrors auth.uid(); not a FK to avoid cross-schema FK
    active_dept_id  UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    hospital_id     UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE RESTRICT,
    session_token   TEXT NOT NULL UNIQUE,   -- opaque 128-bit random token; stored in HttpOnly cookie
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '8 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Primary lookup path: middleware resolves token on every request
CREATE UNIQUE INDEX idx_ssc_token ON public.staff_session_context (session_token);

-- GC path: cleanup function scans for expired rows
CREATE INDEX idx_ssc_expires ON public.staff_session_context (expires_at);

-- Lookup: does this user have an active context right now?
CREATE INDEX idx_ssc_user_active ON public.staff_session_context (auth_user_id, expires_at);

-- ── Cleanup Function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_session_contexts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM public.staff_session_context
    WHERE expires_at < now();
$$;

COMMENT ON FUNCTION public.cleanup_expired_session_contexts() IS
    'Purges expired session context rows. Schedule via pg_cron or a Supabase Edge Function cron job.';

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_session_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_session_context FORCE ROW LEVEL SECURITY;

-- Users can only see their own session context
CREATE POLICY ssc_select ON public.staff_session_context
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());

-- Users can insert their own context (created when dept is selected post-login)
CREATE POLICY ssc_insert ON public.staff_session_context
    FOR INSERT TO authenticated
    WITH CHECK (auth_user_id = auth.uid());

-- service_role handles all cleanup deletes (GC function runs as SECURITY DEFINER)
CREATE POLICY ssc_delete ON public.staff_session_context
    FOR DELETE TO service_role
    USING (true);

COMMENT ON TABLE public.staff_session_context IS
    'Locks in active department choice per login session (8 hours). '
    'session_token stored in HttpOnly cookie sa_dept_ctx. '
    'Middleware injects X-Active-Dept-Id header from this table on every request. '
    'No mid-session switching — staff must re-login to change department.';
