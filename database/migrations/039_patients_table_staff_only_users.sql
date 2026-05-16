-- Migration 039: Dedicated patients table + staff-only users
-- Splits anonymous intake identity out of public.users, keeps users staff-only,
-- and retargets complaint/patient consent linkage to public.patients.

CREATE OR REPLACE FUNCTION public.fn_audit_ledger_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_previous_hash BYTEA;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('audit_logs_ledger'));

    SELECT ledger_hash INTO v_previous_hash
    FROM public.audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_previous_hash IS NULL THEN
        v_previous_hash := '\x0000000000000000000000000000000000000000000000000000000000000000'::BYTEA;
    END IF;

    NEW.previous_hash := v_previous_hash;
    NEW.ledger_hash := extensions.digest(
        COALESCE(NEW.new_data::TEXT, '')::BYTEA || v_previous_hash,
        'sha256'
    );

    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     UUID NOT NULL REFERENCES public.hospitals(id),
    contact_hash    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_hospital_contact_hash
    ON public.patients (hospital_id, contact_hash);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_last_seen
    ON public.patients (hospital_id, last_seen_at DESC);

COMMENT ON TABLE public.patients IS
    'Pseudonymous anonymous-intake identities. One row per hospital-scoped normalized reporter contact hash.';

COMMENT ON COLUMN public.patients.contact_hash IS
    'SHA-256 hash of the normalized reporter contact scoped by hospital id.';

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_select_service_role ON public.patients;
CREATE POLICY patients_select_service_role ON public.patients
    FOR SELECT TO service_role
    USING (true);

DROP POLICY IF EXISTS patients_insert_service_role ON public.patients;
CREATE POLICY patients_insert_service_role ON public.patients
    FOR INSERT TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS patients_update_service_role ON public.patients;
CREATE POLICY patients_update_service_role ON public.patients
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_audit_patients ON public.patients;
CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TEMP TABLE _legacy_patient_user_ids ON COMMIT DROP AS
SELECT id
FROM public.users
WHERE role = 'patient';

CREATE TEMP TABLE _legacy_patient_complaint_ids ON COMMIT DROP AS
SELECT c.id
FROM public.complaints c
INNER JOIN _legacy_patient_user_ids p ON p.id = c.patient_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.complaint_status_history csh
        WHERE csh.complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids)
    ) THEN
        RAISE EXCEPTION
            'Migration 039 cannot purge legacy anonymous complaints because complaint_status_history rows already exist for them. Remove those legacy records manually before rerunning this migration.';
    END IF;
END $$;

DELETE FROM public.local_audit_reads
WHERE complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids);

DELETE FROM public.patient_consents
WHERE complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids)
   OR patient_id IN (SELECT id FROM _legacy_patient_user_ids);

DELETE FROM public.sla_breach_log
WHERE complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids);

DELETE FROM public.notifications
WHERE complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids)
   OR recipient_id IN (SELECT id FROM _legacy_patient_user_ids);

DELETE FROM public.complaint_phi
WHERE complaint_id IN (SELECT id FROM _legacy_patient_complaint_ids);

DELETE FROM public.complaints
WHERE id IN (SELECT id FROM _legacy_patient_complaint_ids);

DELETE FROM public.users
WHERE id IN (SELECT id FROM _legacy_patient_user_ids);

ALTER TABLE public.complaints
    DROP CONSTRAINT IF EXISTS complaints_patient_id_fkey;

ALTER TABLE public.complaints
    ADD CONSTRAINT complaints_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_consents
    DROP CONSTRAINT IF EXISTS patient_consents_patient_id_fkey;

ALTER TABLE public.patient_consents
    ADD CONSTRAINT patient_consents_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check CHECK (role IN (
        'department_manager',
        'quality_coordinator',
        'admin',
        'medical_superintendent',
        'dpo'
    ));

COMMENT ON TABLE public.users IS
    'Staff identities only. Role stored as TEXT with CHECK. department_id nullable for org-level staff roles.';

COMMENT ON COLUMN public.complaints.patient_id IS
    'References public.patients(id). Pseudonymous patient identity reused per hospital-scoped normalized reporter contact.';

COMMENT ON COLUMN public.patient_consents.patient_id IS
    'References public.patients(id). Consent captured for pseudonymous anonymous-intake patients.';

COMMENT ON TABLE public.patient_consents IS
    'DPDP/HIPAA consent records linked to pseudonymous patients. Captured at intake BEFORE any PHI is stored. Withdrawal tracked via withdrawn_at.';

DROP POLICY IF EXISTS complaints_select ON public.complaints;
CREATE POLICY complaints_select ON public.complaints
    FOR SELECT TO authenticated
    USING (
        CASE public.get_my_role()
            WHEN 'department_manager' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
                AND department_id = public.get_active_department_id()
            WHEN 'quality_coordinator' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'admin' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'medical_superintendent' THEN
                hospital_id = public.get_my_hospital_id()
                AND deleted_at IS NULL
            WHEN 'dpo' THEN
                deleted_at IS NULL
            ELSE false
        END
    );

DROP POLICY IF EXISTS complaints_insert_patient ON public.complaints;
DROP POLICY IF EXISTS complaints_insert_service_role ON public.complaints;
CREATE POLICY complaints_insert_service_role ON public.complaints
    FOR INSERT TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS complaint_phi_select ON public.complaint_phi;
CREATE POLICY complaint_phi_select ON public.complaint_phi
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.complaints c
            WHERE c.id = complaint_phi.complaint_id
              AND c.deleted_at IS NULL
              AND (
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = public.get_active_department_id()
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'quality_coordinator'
                   AND c.hospital_id = public.get_my_hospital_id())
              )
        )
    );

DROP POLICY IF EXISTS complaint_phi_insert ON public.complaint_phi;
CREATE POLICY complaint_phi_insert ON public.complaint_phi
    FOR INSERT TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS status_history_select ON public.complaint_status_history;
CREATE POLICY status_history_select ON public.complaint_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.complaints c
            WHERE c.id = complaint_status_history.complaint_id
              AND (
                  (public.get_my_role() = 'department_manager'
                   AND c.department_id = public.get_active_department_id()
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() IN ('quality_coordinator', 'admin', 'medical_superintendent')
                   AND c.hospital_id = public.get_my_hospital_id())
                  OR
                  (public.get_my_role() = 'dpo')
              )
        )
    );

DROP POLICY IF EXISTS consents_select ON public.patient_consents;
CREATE POLICY consents_select ON public.patient_consents
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'dpo');

DROP POLICY IF EXISTS consents_insert ON public.patient_consents;
CREATE POLICY consents_insert ON public.patient_consents
    FOR INSERT TO service_role
    WITH CHECK (true);
