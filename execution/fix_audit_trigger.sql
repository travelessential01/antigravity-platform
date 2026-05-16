CREATE OR REPLACE FUNCTION public.fn_audit_ledger_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
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
    -- Safely convert JSON text to BYTEA using convert_to UTF8 to avoid syntax errors
    NEW.ledger_hash := extensions.digest(
        convert_to(COALESCE(NEW.new_data::TEXT, ''), 'UTF8') || v_previous_hash,
        'sha256'::TEXT
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_complaint_phi ON public.complaint_phi CASCADE;

CREATE TRIGGER trg_audit_complaint_phi
AFTER INSERT OR UPDATE OR DELETE ON public.complaint_phi
FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit_log();
