-- Migration 032: webauthn_credentials
-- Stores FIDO2/WebAuthn public key credentials for biometric second-factor authentication.
-- Implemented via @simplewebauthn/browser + @simplewebauthn/server (custom M2 integration)
-- pending Supabase native WebAuthn GA (expected Q3 2026).
--
-- IMPORTANT: No raw biometric data is stored. Only the FIDO2 public key and usage metadata.
-- The private key never leaves the user's device hardware module (TPM / Secure Enclave).

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- FIDO2 core fields
    credential_id   TEXT NOT NULL UNIQUE,       -- Base64URL-encoded credential ID from authenticator
    public_key      BYTEA NOT NULL,             -- COSE-encoded public key (stored, never the private key)
    counter         BIGINT NOT NULL DEFAULT 0,  -- Monotonic counter for replay attack prevention

    -- Authenticator metadata
    transports      TEXT[],                     -- ['internal', 'hybrid', 'usb', 'nfc', 'ble']
    device_name     TEXT,                       -- Human-readable label e.g. "iPhone 15 Pro Face ID"
    aaguid          UUID,                       -- Authenticator model GUID (FIDO MDS lookup)

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Authentication path: look up credential by ID from authenticator assertion
CREATE UNIQUE INDEX idx_wc_credential_id ON public.webauthn_credentials (credential_id);

-- Registration check: list all credentials for a user
CREATE INDEX idx_wc_user_id ON public.webauthn_credentials (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials FORCE ROW LEVEL SECURITY;

-- Users can read their own credentials (e.g. to list enrolled devices)
CREATE POLICY wc_select ON public.webauthn_credentials
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- service_role handles all writes (registration + counter update are server-side operations)
CREATE POLICY wc_insert ON public.webauthn_credentials
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY wc_update ON public.webauthn_credentials
    FOR UPDATE TO service_role
    USING (true);

CREATE POLICY wc_delete ON public.webauthn_credentials
    FOR DELETE TO authenticated
    USING (
        -- Users can remove their own enrolled devices
        user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

COMMENT ON TABLE public.webauthn_credentials IS
    'FIDO2 WebAuthn public key credentials for biometric auth (Face ID / Fingerprint / Windows Hello). '
    'Only public keys stored — no raw biometric data. counter column prevents replay attacks.';

COMMENT ON COLUMN public.webauthn_credentials.counter IS
    'Monotonically increasing sign count from the authenticator. '
    'Server rejects any assertion where new_counter <= stored_counter (replay attack detection).';
