-- Migration 008: Create complaint_phi table (ALE — BYTEA ciphertext only)
-- 1:1 relationship with complaints
-- ALL THREE PHI fields stored as AES-256-GCM ciphertext (BYTEA)
-- Encryption/decryption happens EXCLUSIVELY in Next.js Server Actions
-- The database is entirely blind to plaintext PHI
-- semgrep SAST rule blocks any PR calling pgp_sym_encrypt() on these columns

CREATE TABLE IF NOT EXISTS public.complaint_phi (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID NOT NULL UNIQUE REFERENCES public.complaints(id),  -- 1:1 relationship
    description     BYTEA NOT NULL,       -- AES-256-GCM ciphertext; plaintext NEVER stored in DB
    reporter_name   BYTEA NOT NULL,       -- AES-256-GCM ciphertext
    reporter_contact BYTEA NOT NULL,      -- AES-256-GCM ciphertext
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ DEFAULT NULL
);

COMMENT ON TABLE public.complaint_phi IS 'PHI partition — 1:1 with complaints. ALL columns are AES-256-GCM ciphertext (BYTEA). DB stores ciphertext only.';
COMMENT ON COLUMN public.complaint_phi.description IS 'AES-256-GCM encrypted complaint description. Decryption in Server Actions only.';
COMMENT ON COLUMN public.complaint_phi.reporter_name IS 'AES-256-GCM encrypted patient/reporter name. Decryption in Server Actions only.';
COMMENT ON COLUMN public.complaint_phi.reporter_contact IS 'AES-256-GCM encrypted contact info. Decryption in Server Actions only.';
