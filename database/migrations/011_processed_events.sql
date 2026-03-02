-- Migration 011: Create processed_events table
-- Idempotency guard for Edge Functions — prevents duplicate processing on retries
-- pg_cron purge after 7 days (configured at bottom)

CREATE TABLE IF NOT EXISTS public.processed_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name  TEXT NOT NULL,
    event_id    TEXT NOT NULL UNIQUE,    -- deduplication key
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient pg_cron purge
CREATE INDEX idx_processed_events_created_at
    ON public.processed_events (created_at);

-- Schedule nightly purge at 02:00 IST (20:30 UTC previous day)
-- pg_cron extension must be enabled; this is safe to fail silently if not available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'purge_processed_events',
            '30 20 * * *',  -- 02:00 IST = 20:30 UTC
            $$DELETE FROM public.processed_events WHERE created_at < NOW() - INTERVAL '7 days'$$
        );
    END IF;
END $$;

COMMENT ON TABLE public.processed_events IS 'Idempotency guard for Edge Functions. Auto-purged after 7 days via pg_cron.';
