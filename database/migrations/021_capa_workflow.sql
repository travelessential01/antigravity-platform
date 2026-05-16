-- Migration 021: Dual-Signature CAPA Workflow

-- 1. Add signature fields to the complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS msd_signature_jwt TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ms_signature_jwt TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS capa_validation_date TIMESTAMPTZ;

-- 2. 'capa_validated' is already in the CHECK constraint defined in 007_complaints.sql.
--    This migration is a no-op for the status enum — no ALTER TYPE needed.
--    (complaint_status is a TEXT CHECK, not a pg enum type)

-- 3. Comments
COMMENT ON COLUMN complaints.msd_signature_jwt IS 'JWT signature token of the Medico-Social Department signing the CAPA';
COMMENT ON COLUMN complaints.ms_signature_jwt IS 'JWT signature token of the Medical Superintendent signing the CAPA';
COMMENT ON COLUMN complaints.capa_validation_date IS 'Timestamp when the CAPA was fully validated (both signatures present)';
