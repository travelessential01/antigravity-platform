-- Migration 043: SLA escalation fallback to Quality Coordinator
-- Keeps on-call routing as first choice, then falls back to an active
-- same-hospital quality_coordinator when no matching on-call schedule exists.

CREATE OR REPLACE FUNCTION public.resolve_acknowledgement_escalation_recipient(
    p_hospital_id UUID,
    p_department_id UUID,
    p_primary BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    SELECT u.id
    INTO v_recipient_id
    FROM public.on_call_schedules ocs
    JOIN public.users u
      ON u.id = ocs.user_id
     AND u.hospital_id = p_hospital_id
     AND u.is_active = TRUE
     AND u.deleted_at IS NULL
    WHERE ocs.hospital_id = p_hospital_id
      AND ocs.department_id = p_department_id
      AND ocs.is_primary_on_call = p_primary
      AND ocs.deleted_at IS NULL
      AND ocs.shift_start <= now()
      AND ocs.shift_end > now()
    ORDER BY ocs.shift_start DESC
    LIMIT 1;

    IF v_recipient_id IS NULL THEN
        SELECT u.id
        INTO v_recipient_id
        FROM public.users u
        WHERE u.hospital_id = p_hospital_id
          AND u.role = 'quality_coordinator'
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
        ORDER BY u.created_at ASC, u.id ASC
        LIMIT 1;
    END IF;

    RETURN v_recipient_id;
END;
$$;

COMMENT ON FUNCTION public.resolve_acknowledgement_escalation_recipient(UUID, UUID, BOOLEAN) IS
    'Returns the active on-call acknowledgement escalation recipient, falling back to the same-hospital Quality Coordinator.';

REVOKE ALL ON FUNCTION public.resolve_acknowledgement_escalation_recipient(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_acknowledgement_escalation_recipient(UUID, UUID, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.escalate_primary_acknowledgement_breach(
    p_complaint_id UUID,
    p_clinical_sla_minutes INTEGER,
    p_secure_link_id UUID,
    p_deep_link TEXT
)
RETURNS TABLE (
    outcome TEXT,
    recipient_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_complaint public.complaints%ROWTYPE;
    v_recipient_id UUID;
BEGIN
    SELECT *
    INTO v_complaint
    FROM public.complaints
    WHERE id = p_complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'missing', NULL::UUID;
        RETURN;
    END IF;

    IF v_complaint.status <> 'submitted' THEN
        RETURN QUERY
        SELECT 'noop', NULL::UUID;
        RETURN;
    END IF;

    v_recipient_id := public.resolve_acknowledgement_escalation_recipient(
        v_complaint.hospital_id,
        v_complaint.department_id,
        TRUE
    );

    INSERT INTO public.sla_breach_log (
        complaint_id,
        breached_stage,
        escalated_to,
        notes
    ) VALUES (
        v_complaint.id,
        'acknowledgement',
        v_recipient_id,
        format(
            'Primary escalation fired after %s minute acknowledgement SLA.',
            p_clinical_sla_minutes
        )
    );

    IF v_recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_id,
            complaint_id,
            channel,
            secure_link_id,
            deep_link,
            status
        ) VALUES (
            v_recipient_id,
            v_complaint.id,
            'in_app',
            p_secure_link_id,
            p_deep_link,
            'pending'
        );
    END IF;

    UPDATE public.complaints
    SET status = 'escalated',
        updated_at = now()
    WHERE id = v_complaint.id;

    RETURN QUERY
    SELECT
        CASE
            WHEN v_recipient_id IS NULL THEN 'escalated_unassigned'
            ELSE 'escalated'
        END,
        v_recipient_id;
END;
$$;

COMMENT ON FUNCTION public.escalate_primary_acknowledgement_breach(UUID, INTEGER, UUID, TEXT) IS
    'Atomically logs a primary acknowledgement breach, creates the pending notification when a recipient is found, and marks the complaint escalated.';

REVOKE ALL ON FUNCTION public.escalate_primary_acknowledgement_breach(UUID, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_primary_acknowledgement_breach(UUID, INTEGER, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.escalate_secondary_acknowledgement_breach(
    p_complaint_id UUID,
    p_secure_link_id UUID,
    p_deep_link TEXT
)
RETURNS TABLE (
    outcome TEXT,
    recipient_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_complaint public.complaints%ROWTYPE;
    v_recipient_id UUID;
BEGIN
    SELECT *
    INTO v_complaint
    FROM public.complaints
    WHERE id = p_complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'missing', NULL::UUID;
        RETURN;
    END IF;

    IF v_complaint.status <> 'escalated' THEN
        RETURN QUERY
        SELECT 'noop', NULL::UUID;
        RETURN;
    END IF;

    v_recipient_id := public.resolve_acknowledgement_escalation_recipient(
        v_complaint.hospital_id,
        v_complaint.department_id,
        FALSE
    );

    INSERT INTO public.sla_breach_log (
        complaint_id,
        breached_stage,
        escalated_to,
        notes
    ) VALUES (
        v_complaint.id,
        'acknowledgement',
        v_recipient_id,
        'Secondary escalation fired after 15 minutes without acknowledgment.'
    );

    UPDATE public.notifications
    SET status = 'expired'
    WHERE complaint_id = v_complaint.id
      AND status = 'pending';

    IF v_recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_id,
            complaint_id,
            channel,
            secure_link_id,
            deep_link,
            status
        ) VALUES (
            v_recipient_id,
            v_complaint.id,
            'in_app',
            p_secure_link_id,
            p_deep_link,
            'pending'
        );
    END IF;

    RETURN QUERY
    SELECT
        CASE
            WHEN v_recipient_id IS NULL THEN 'secondary_unassigned'
            ELSE 'secondary_escalated'
        END,
        v_recipient_id;
END;
$$;

COMMENT ON FUNCTION public.escalate_secondary_acknowledgement_breach(UUID, UUID, TEXT) IS
    'Atomically logs a secondary acknowledgement breach, expires prior pending notifications, and creates the follow-up notification when a recipient is found.';

REVOKE ALL ON FUNCTION public.escalate_secondary_acknowledgement_breach(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_secondary_acknowledgement_breach(UUID, UUID, TEXT) TO service_role;
