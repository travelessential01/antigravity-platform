-- Migration 023: Create local_audit_reads
-- Resolves Sprint 1-6 spillover gap where Server Actions logged PHI access to a non-existent table

CREATE TABLE IF NOT EXISTS public.local_audit_reads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID NOT NULL,
    department_id   UUID NOT NULL, -- The dept they claimed to be acting under
    complaint_id    UUID NOT NULL REFERENCES public.complaints(id),
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dpo/admin forensic queries
CREATE INDEX IF NOT EXISTS idx_local_audit_reads_actor ON public.local_audit_reads (actor_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_local_audit_reads_complaint ON public.local_audit_reads (complaint_id);

-- Enable RLS
ALTER TABLE public.local_audit_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_audit_reads FORCE ROW LEVEL SECURITY;

-- DPO and Admin can read all access logs
CREATE POLICY audit_reads_select ON public.local_audit_reads
    FOR SELECT TO authenticated
    USING (
        public.get_my_role() IN ('dpo', 'admin', 'medical_superintendent')
    );

-- Only service_role (from Server Action bypassing RLS) can insert
CREATE POLICY audit_reads_insert ON public.local_audit_reads
    FOR INSERT TO service_role
    WITH CHECK (true);

-- No one can update or delete (immutable read-audit log)
REVOKE UPDATE, DELETE ON public.local_audit_reads FROM authenticated;
REVOKE UPDATE, DELETE ON public.local_audit_reads FROM anon;

-- 90-day pg_cron purge (if pg_cron is enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'purge_local_audit_reads',
            '45 20 * * *',  -- 02:15 IST = 20:45 UTC
            $cron$DELETE FROM public.local_audit_reads WHERE read_at < NOW() - INTERVAL '90 days'$cron$
        );
    END IF;
END $$;

COMMENT ON TABLE public.local_audit_reads IS 'Local DB sink for PHI read access events. Primary long-term storage is offshore Elasticsearch (ap-south-1). Auto-purged after 90 days.';
