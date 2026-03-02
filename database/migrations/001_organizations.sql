-- Migration 001: Enable pgcrypto extension + Create organizations table
-- pgcrypto is retained ONLY for ledger_hash (SHA-256 chaining on audit_logs)
-- It is NOT used for PHI encryption (that's ALE in the application layer)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ DEFAULT NULL
);

COMMENT ON TABLE public.organizations IS 'Multi-tenancy root. Each organization can have multiple hospitals.';
