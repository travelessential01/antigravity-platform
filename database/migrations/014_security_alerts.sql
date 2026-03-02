-- Migration 014: Create security_alerts table
-- Write-only from triggers (tamper detection); read-only for DevOps role
-- Triggered when ledger_hash mismatch is detected

CREATE TABLE IF NOT EXISTS public.security_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type          TEXT NOT NULL CHECK (alert_type IN (
                            'LEDGER_TAMPER', 'ROLE_ESCALATION',
                            'UNAUTHORIZED_PHI_ACCESS', 'BRUTE_FORCE',
                            'SUSPICIOUS_ACTIVITY'
                        )),
    source_table        TEXT,
    source_record_id    UUID,
    details             JSONB,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by         UUID,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_type ON public.security_alerts (alert_type, created_at DESC);
CREATE INDEX idx_security_alerts_unresolved ON public.security_alerts (resolved, created_at DESC)
    WHERE resolved = FALSE;

-- Restrict to write-only from triggers, read-only for authenticated users
REVOKE UPDATE, DELETE ON public.security_alerts FROM anon, authenticated;

COMMENT ON TABLE public.security_alerts IS 'Write-only security alerts from triggers. Read-only for DevOps. Tamper/escalation detection.';
