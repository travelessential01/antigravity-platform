-- Migration 015: Create patient_consents table
-- DPDP Act 2023 / HIPAA legal basis
-- Consent captured at intake BEFORE writing complaint_phi

CREATE TABLE IF NOT EXISTS public.patient_consents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES public.users(id),
    complaint_id        UUID NOT NULL REFERENCES public.complaints(id),
    consent_version     TEXT NOT NULL,       -- e.g. 'v1.0', 'v2.1'
    ip_address          INET,
    user_agent          TEXT,
    consented_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at        TIMESTAMPTZ DEFAULT NULL
);

-- Consent verification index at intake
CREATE INDEX idx_patient_consents_lookup
    ON public.patient_consents (patient_id, complaint_id);

CREATE INDEX idx_patient_consents_version
    ON public.patient_consents (consent_version, consented_at DESC);

COMMENT ON TABLE public.patient_consents IS 'DPDP/HIPAA consent records. Captured at intake BEFORE any PHI is stored. Withdrawal tracked via withdrawn_at.';
