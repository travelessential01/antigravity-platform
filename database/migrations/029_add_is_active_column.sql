-- Migration 029: Add is_active deactivation flag to users table
-- Sprint A.2 — Centralized Auth Guard
-- Purpose: Enables soft-deactivation of staff accounts without deleting them.
--           Staff set to false lose PHI access within JWT expiry window (30 min).

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.is_active IS
    'Soft-deactivation flag. Staff set to false lose PHI access within JWT expiry window (30 min). Set by Admin via management console.';
