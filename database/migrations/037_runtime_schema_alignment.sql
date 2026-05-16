-- Migration 037: Runtime schema alignment
-- Brings the checked-in schema in line with the runtime code paths used by
-- staff login, anonymous intake, complaint workflow updates, and SLA updates.

-- =============================================================================
-- USERS: staff phone lookup support
-- =============================================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_users_hospital_phone_active
    ON public.users (hospital_id, phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.users.phone IS
    'E.164 phone number used for staff OTP login lookup within a hospital.';

-- =============================================================================
-- COMPLAINTS: workflow update timestamps
-- =============================================================================

ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_complaints_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.update_complaints_timestamp();

COMMENT ON COLUMN public.complaints.updated_at IS
    'Tracks the most recent workflow mutation for complaint status transitions.';

-- =============================================================================
-- COMPLAINT PHI: key version for encryption rotation
-- =============================================================================

ALTER TABLE public.complaint_phi
    ADD COLUMN IF NOT EXISTS key_version INTEGER;

ALTER TABLE public.complaint_phi
    ALTER COLUMN key_version SET DEFAULT 1;

UPDATE public.complaint_phi
SET key_version = 1
WHERE key_version IS NULL;

ALTER TABLE public.complaint_phi
    ALTER COLUMN key_version SET NOT NULL;

COMMENT ON COLUMN public.complaint_phi.key_version IS
    'Application-managed AES-GCM master key version used to encrypt this PHI row.';

-- =============================================================================
-- SLA CONFIGURATIONS: admin update timestamps
-- =============================================================================

ALTER TABLE public.sla_configurations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_sla_configurations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sla_configurations_updated_at ON public.sla_configurations;
CREATE TRIGGER trg_sla_configurations_updated_at
    BEFORE UPDATE ON public.sla_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sla_configurations_timestamp();

COMMENT ON COLUMN public.sla_configurations.updated_at IS
    'Tracks the most recent change to this hospital or department SLA configuration.';
