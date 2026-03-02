-- Migration 002: Create hospitals table
-- Linked to organizations with NABH/JCI accreditation booleans

CREATE TABLE IF NOT EXISTS public.hospitals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES public.organizations(id),
    name                TEXT NOT NULL,
    nabh_accredited     BOOLEAN NOT NULL DEFAULT FALSE,
    jci_accredited      BOOLEAN NOT NULL DEFAULT FALSE,
    address             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_hospitals_organization_id ON public.hospitals(organization_id);

COMMENT ON TABLE public.hospitals IS 'Per-facility configuration with accreditation status. FK to organizations.';
