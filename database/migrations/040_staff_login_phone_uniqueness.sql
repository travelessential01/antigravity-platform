-- Migration 040: Staff login phone uniqueness
-- Enforces the runtime assumption that each hospital-scoped active staff phone
-- number maps to exactly one undeleted user row.

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER
    INTO duplicate_count
    FROM (
        SELECT hospital_id, phone
        FROM public.users
        WHERE hospital_id IS NOT NULL
          AND phone IS NOT NULL
          AND deleted_at IS NULL
          AND is_active = TRUE
        GROUP BY hospital_id, phone
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration 040 cannot enforce unique active staff phones because % duplicate hospital/phone combinations already exist in public.users. Resolve duplicates first.',
            duplicate_count;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_users_hospital_phone_active;

CREATE UNIQUE INDEX idx_users_hospital_phone_active
    ON public.users (hospital_id, phone)
    WHERE hospital_id IS NOT NULL
      AND phone IS NOT NULL
      AND deleted_at IS NULL
      AND is_active = TRUE;
