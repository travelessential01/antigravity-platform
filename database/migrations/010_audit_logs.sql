-- Migration 010: Create audit_logs table (IMMUTABLE + Ledger Hash)
-- Chained SHA-256 hash: ledger_hash = digest(new_data || previous_hash, 'sha256')
-- Computed synchronously in trigger (Task 1.4) within the same transaction
-- Advisory locking serialises writes under high concurrency

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    action_type     TEXT NOT NULL CHECK (action_type IN (
                        'INSERT', 'UPDATE', 'DELETE',
                        'LOGIN_SUCCESS', 'LOGIN_FAILURE',
                        'MFA_CHALLENGE', 'SESSION_TIMEOUT',
                        'ROLE_ESCALATION_ATTEMPT',
                        'PHI_ACCESS', 'CAPA_SIGN_OFF',
                        'CONSENT_GRANTED', 'CONSENT_WITHDRAWN',
                        'TAMPER_DETECTED'
                    )),
    old_data        JSONB,
    new_data        JSONB,
    performed_by    UUID,  -- references users.id but not FK'd to avoid circular deps
    ledger_hash     BYTEA,      -- SHA-256 chained hash computed by trigger
    previous_hash   BYTEA,      -- hash of previous record for chain verification
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    -- No deleted_at: immutable table
);

-- DPO timeline query index
CREATE INDEX idx_audit_logs_record_timeline
    ON public.audit_logs (record_id, created_at DESC);

CREATE INDEX idx_audit_logs_performed_by
    ON public.audit_logs (performed_by, created_at DESC);

CREATE INDEX idx_audit_logs_action_type
    ON public.audit_logs (action_type);

-- IMMUTABILITY: Revoke UPDATE and DELETE from all application roles
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated, service_role;

COMMENT ON TABLE public.audit_logs IS 'IMMUTABLE cryptographic audit ledger. ledger_hash = sha256(data || previous_hash). No UPDATE/DELETE permitted.';
