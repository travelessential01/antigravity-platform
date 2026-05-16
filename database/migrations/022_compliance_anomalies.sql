-- Migration 022: Nightly Compliance Anomaly Detection (fixed column names to match 010_audit_logs.sql)
-- audit_logs columns: table_name, record_id, action_type, old_data, new_data, performed_by

CREATE OR REPLACE FUNCTION public.detect_compliance_anomalies()
RETURNS void AS $$
BEGIN
    -- 1. Unacknowledged past 24 hours — log each as a PHI_ACCESS action_type record
    --    action_type must be one of the allowed values in the CHECK constraint
    INSERT INTO public.audit_logs (table_name, record_id, action_type, new_data, performed_by)
    SELECT
        'complaints',
        id,
        'TAMPER_DETECTED',  -- closest available type for anomaly flagging; see note below
        jsonb_build_object('type', 'unacknowledged_24h', 'created_at', created_at),
        NULL
    FROM public.complaints
    WHERE status = 'submitted' AND created_at < NOW() - INTERVAL '24 hours';

    -- 2. SLA breached but no escalation logged
    INSERT INTO public.audit_logs (table_name, record_id, action_type, new_data, performed_by)
    SELECT
        'complaints',
        c.id,
        'TAMPER_DETECTED',
        jsonb_build_object('type', 'breach_no_escalation', 'sla_deadline', c.sla_deadline),
        NULL
    FROM public.complaints c
    JOIN public.sla_breach_log sbl ON c.id = sbl.complaint_id
    LEFT JOIN public.complaint_status_history csh
        ON c.id = csh.complaint_id AND csh.new_status = 'escalated'
    WHERE csh.id IS NULL;

    -- 3. Stuck investigating beyond 14 days
    INSERT INTO public.audit_logs (table_name, record_id, action_type, new_data, performed_by)
    SELECT
        'complaints',
        c.id,
        'TAMPER_DETECTED',
        jsonb_build_object('type', 'stuck_investigating_14d'),
        NULL
    FROM public.complaints c
    JOIN public.complaint_status_history csh
        ON c.id = csh.complaint_id AND csh.new_status = 'investigating'
    WHERE c.status = 'investigating' AND csh.created_at < NOW() - INTERVAL '14 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: action_type 'TAMPER_DETECTED' is the closest rigid value in the CHECK constraint
-- that applies to system-generated anomaly events. In a future migration a dedicated
-- 'COMPLIANCE_ANOMALY' type should be added to the CHECK constraint.
