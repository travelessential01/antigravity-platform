-- Migration 033: hospital_code
-- Adds a short 6-character alphanumeric identifier to each hospital.
-- Used on the new /login page so staff can identify their hospital
-- without typing a full UUID.
-- Format example: "NHDELH", "AIIMS1", "MAXGUR"

ALTER TABLE public.hospitals
    ADD COLUMN IF NOT EXISTS hospital_code VARCHAR(6) UNIQUE;

-- Enforce NOT NULL after any existing rows have been backfilled (see below)
-- Step 1: backfill existing hospitals with placeholder codes
-- Generate deterministic short codes from the first 6 chars of the UUID (uppercased, filtered to alphanumeric)
UPDATE public.hospitals
SET hospital_code = UPPER(SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 6))
WHERE hospital_code IS NULL;

-- Step 2: now enforce NOT NULL
ALTER TABLE public.hospitals
    ALTER COLUMN hospital_code SET NOT NULL;

-- Step 3: enforce CHECK — exactly 6 alphanumeric characters (A-Z, 0-9)
ALTER TABLE public.hospitals
    ADD CONSTRAINT chk_hospital_code_format
    CHECK (hospital_code ~ '^[A-Z0-9]{6}$');

-- ── Index ──────────────────────────────────────────────────────────────────────

-- Login page lookup: hospitals.hospital_code → hospital UUID
CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_code
    ON public.hospitals (hospital_code);

COMMENT ON COLUMN public.hospitals.hospital_code IS
    '6-character alphanumeric short code for this hospital (uppercase A-Z, 0-9). '
    'Used as the human-readable hospital identifier on the staff login page. '
    'Must be set/updated by admins via the hospital management UI. '
    'Example: NHDELH, AIIMS1, MAXGUR.';
