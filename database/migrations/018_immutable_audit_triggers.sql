-- Migration 018: Immutable Audit Triggers
-- 1. Chained SHA-256 ledger hash on audit_logs (pgcrypto)
-- 2. Automatic status history recording on complaints
-- 3. Tamper detection alerting on audit_logs
-- 4. Generic audit logging trigger for all auditable tables

-- =============================================================
-- 1. LEDGER HASH TRIGGER: Chained SHA-256 on audit_logs
--    Formula: ledger_hash = digest(new_data || previous_hash, 'sha256')
--    Advisory lock serialises concurrent writes for chain integrity
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_audit_ledger_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_previous_hash BYTEA;
BEGIN
    -- Advisory lock to serialise writes (prevents race conditions in hash chain)
    PERFORM pg_advisory_xact_lock(hashtext('audit_logs_ledger'));

    -- Get the hash of the most recent audit log entry
    SELECT ledger_hash INTO v_previous_hash
    FROM public.audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- For the first ever entry, use a zero hash
    IF v_previous_hash IS NULL THEN
        v_previous_hash := '\x0000000000000000000000000000000000000000000000000000000000000000'::BYTEA;
    END IF;

    -- Compute chained hash: SHA-256(new_data_json || previous_hash)
    NEW.previous_hash := v_previous_hash;
    NEW.ledger_hash := digest(
        COALESCE(NEW.new_data::TEXT, '')::BYTEA || v_previous_hash,
        'sha256'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_ledger_hash
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_ledger_hash();

-- =============================================================
-- 2. COMPLAINT STATUS HISTORY TRIGGER
--    On every UPDATE to complaints.status, insert into complaint_status_history
--    Within the same transaction for atomicity
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_complaint_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only fire when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.complaint_status_history (
            complaint_id,
            previous_status,
            new_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::UUID
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_status_change
    AFTER UPDATE OF status ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_complaint_status_change();

-- =============================================================
-- 3. TAMPER DETECTION TRIGGER on audit_logs
--    If anyone manages to UPDATE or DELETE audit_logs (shouldn't be possible
--    due to REVOKE, but defense-in-depth), fire a security alert
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_audit_tamper_detect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert security alert for tamper attempt
    INSERT INTO public.security_alerts (
        alert_type,
        source_table,
        source_record_id,
        details
    ) VALUES (
        'LEDGER_TAMPER',
        'audit_logs',
        COALESCE(OLD.id, NEW.id),
        jsonb_build_object(
            'trigger_operation', TG_OP,
            'attempted_at', now(),
            'old_ledger_hash', encode(OLD.ledger_hash, 'hex'),
            'session_user', session_user,
            'client_addr', inet_client_addr()
        )
    );

    -- Also insert a tamper audit log entry (this will get its own ledger hash)
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action_type,
        old_data,
        new_data,
        performed_by
    ) VALUES (
        'audit_logs',
        OLD.id,
        'TAMPER_DETECTED',
        to_jsonb(OLD),
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        NULL
    );

    -- Block the operation
    RAISE EXCEPTION 'TAMPER DETECTED: % operation on audit_logs is prohibited. Security alert fired.', TG_OP;

    RETURN NULL;
END;
$$;

-- These triggers fire BEFORE the forbidden operation
-- They will raise an exception, blocking the operation and rolling back
CREATE TRIGGER trg_audit_tamper_update
    BEFORE UPDATE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_tamper_detect();

CREATE TRIGGER trg_audit_tamper_delete
    BEFORE DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_tamper_detect();

-- =============================================================
-- 4. GENERIC AUDIT LOGGING TRIGGER
--    Attach to all auditable tables to automatically log changes
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_generic_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action TEXT;
    v_old JSONB;
    v_new JSONB;
    v_record_id UUID;
    v_performed_by UUID;
BEGIN
    -- Determine action type
    v_action := TG_OP;  -- INSERT, UPDATE, DELETE

    -- Get the performer from JWT claims
    BEGIN
        v_performed_by := NULLIF(
            current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''
        )::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_performed_by := NULL;
    END;

    -- Build old/new data and get record ID
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_new := NULL;
        v_record_id := OLD.id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'INSERT' THEN
        v_old := NULL;
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;
    END IF;

    -- Insert audit log entry (ledger hash computed by trg_audit_ledger_hash)
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action_type,
        old_data,
        new_data,
        performed_by
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        v_action,
        v_old,
        v_new,
        v_performed_by
    );

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- =============================================================
-- 5. ATTACH GENERIC AUDIT TRIGGER to critical tables
--    (Not on audit_logs itself to avoid infinite recursion)
-- =============================================================

CREATE TRIGGER trg_audit_complaints
    AFTER INSERT OR UPDATE OR DELETE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TRIGGER trg_audit_complaint_phi
    AFTER INSERT OR UPDATE OR DELETE ON public.complaint_phi
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TRIGGER trg_audit_sla_config
    AFTER INSERT OR UPDATE OR DELETE ON public.sla_configurations
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TRIGGER trg_audit_on_call
    AFTER INSERT OR UPDATE OR DELETE ON public.on_call_schedules
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

CREATE TRIGGER trg_audit_patient_consents
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_consents
    FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();

-- =============================================================
-- 6. STATUS HISTORY TAMPER PROTECTION
--    Same pattern as audit_logs — block UPDATE/DELETE
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_status_history_tamper_detect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.security_alerts (
        alert_type,
        source_table,
        source_record_id,
        details
    ) VALUES (
        'LEDGER_TAMPER',
        'complaint_status_history',
        OLD.id,
        jsonb_build_object(
            'trigger_operation', TG_OP,
            'attempted_at', now(),
            'session_user', session_user
        )
    );

    RAISE EXCEPTION 'TAMPER DETECTED: % on complaint_status_history is prohibited.', TG_OP;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_status_history_tamper_update
    BEFORE UPDATE ON public.complaint_status_history
    FOR EACH ROW EXECUTE FUNCTION public.fn_status_history_tamper_detect();

CREATE TRIGGER trg_status_history_tamper_delete
    BEFORE DELETE ON public.complaint_status_history
    FOR EACH ROW EXECUTE FUNCTION public.fn_status_history_tamper_detect();
