-- Migration 042: Retry-safe acknowledge flow helpers + atomic escalation helpers
-- Adds DB-backed helpers so acknowledge and escalation flows can mutate
-- complaints, notifications, breach logs, and processed_events atomically.

CREATE OR REPLACE FUNCTION public.get_effective_actor_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_actor_user_id', true), '')::UUID,
        public.get_my_user_id()
    );
$$;

COMMENT ON FUNCTION public.get_effective_actor_user_id() IS
    'Returns the app-level public.users.id for the current actor. Prefers an explicit app.current_actor_user_id override, then falls back to get_my_user_id().';

CREATE OR REPLACE FUNCTION public.fn_complaint_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_changed_by UUID;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_changed_by := public.get_effective_actor_user_id();

        INSERT INTO public.complaint_status_history (
            complaint_id,
            previous_status,
            new_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            v_changed_by
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_generic_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action TEXT;
    v_old JSONB;
    v_new JSONB;
    v_record_id UUID;
    v_performed_by UUID;
BEGIN
    v_action := TG_OP;
    v_performed_by := public.get_effective_actor_user_id();

    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_new := NULL;
        v_record_id := OLD.id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSE
        v_old := NULL;
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id;
    END IF;

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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_notification_link(
    p_complaint_id UUID,
    p_secure_link_id UUID
)
RETURNS TABLE (
    outcome TEXT,
    complaint_id UUID,
    notification_id UUID,
    notification_consumed BOOLEAN,
    should_cancel_primary BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification public.notifications%ROWTYPE;
    v_complaint public.complaints%ROWTYPE;
    v_event_key TEXT := format('acknowledge-click:%s', p_secure_link_id);
BEGIN
    SELECT *
    INTO v_notification
    FROM public.notifications
    WHERE complaint_id = p_complaint_id
      AND secure_link_id = p_secure_link_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'unknown', p_complaint_id, NULL::UUID, FALSE, FALSE;
        RETURN;
    END IF;

    IF v_notification.status = 'expired' THEN
        RETURN QUERY
        SELECT 'expired', v_notification.complaint_id, v_notification.id, FALSE, FALSE;
        RETURN;
    END IF;

    SELECT *
    INTO v_complaint
    FROM public.complaints
    WHERE id = v_notification.complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'complaint_missing', p_complaint_id, v_notification.id, FALSE, FALSE;
        RETURN;
    END IF;

    PERFORM set_config(
        'app.current_actor_user_id',
        COALESCE(v_notification.recipient_id::TEXT, ''),
        TRUE
    );

    IF v_notification.status = 'read' THEN
        RETURN QUERY
        SELECT 'already_read', v_complaint.id, v_notification.id, FALSE, FALSE;
        RETURN;
    END IF;

    IF v_complaint.status IN ('submitted', 'escalated') THEN
        UPDATE public.complaints
        SET status = 'acknowledged',
            updated_at = now()
        WHERE id = v_complaint.id;

        UPDATE public.notifications
        SET status = 'read',
            read_at = COALESCE(read_at, now())
        WHERE id = v_notification.id;

        INSERT INTO public.processed_events (
            event_name,
            event_id,
            payload
        ) VALUES (
            'acknowledge_click_completed',
            v_event_key,
            jsonb_build_object(
                'complaint_id', v_complaint.id,
                'notification_id', v_notification.id,
                'secure_link_id', p_secure_link_id,
                'outcome', 'acknowledged'
            )
        )
        ON CONFLICT (event_id) DO UPDATE
        SET event_name = EXCLUDED.event_name,
            payload = EXCLUDED.payload;

        RETURN QUERY
        SELECT 'acknowledged', v_complaint.id, v_notification.id, TRUE, TRUE;
        RETURN;
    END IF;

    UPDATE public.notifications
    SET status = 'read',
        read_at = COALESCE(read_at, now())
    WHERE id = v_notification.id;

    INSERT INTO public.processed_events (
        event_name,
        event_id,
        payload
    ) VALUES (
        'acknowledge_click_completed',
        v_event_key,
        jsonb_build_object(
            'complaint_id', v_complaint.id,
            'notification_id', v_notification.id,
            'secure_link_id', p_secure_link_id,
            'outcome', 'already_acknowledged'
        )
    )
    ON CONFLICT (event_id) DO UPDATE
    SET event_name = EXCLUDED.event_name,
        payload = EXCLUDED.payload;

    RETURN QUERY
    SELECT 'already_acknowledged', v_complaint.id, v_notification.id, TRUE, FALSE;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_notification_link(UUID, UUID) IS
    'Atomically acknowledges a secure complaint notification link, updates complaint/notification state, and records the completion event after success.';

REVOKE ALL ON FUNCTION public.acknowledge_notification_link(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_notification_link(UUID, UUID) TO service_role;

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

    SELECT ocs.user_id
    INTO v_recipient_id
    FROM public.on_call_schedules ocs
    WHERE ocs.hospital_id = v_complaint.hospital_id
      AND ocs.department_id = v_complaint.department_id
      AND ocs.is_primary_on_call = TRUE
      AND ocs.deleted_at IS NULL
      AND ocs.shift_start <= now()
      AND ocs.shift_end > now()
    ORDER BY ocs.shift_start DESC
    LIMIT 1;

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

    SELECT ocs.user_id
    INTO v_recipient_id
    FROM public.on_call_schedules ocs
    WHERE ocs.hospital_id = v_complaint.hospital_id
      AND ocs.department_id = v_complaint.department_id
      AND ocs.is_primary_on_call = FALSE
      AND ocs.deleted_at IS NULL
      AND ocs.shift_start <= now()
      AND ocs.shift_end > now()
    ORDER BY ocs.shift_start DESC
    LIMIT 1;

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
