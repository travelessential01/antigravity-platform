-- Migration 044: Fix ambiguous complaint_id reference in acknowledge RPC
-- The function returns a column named complaint_id, so table columns must be
-- qualified inside the PL/pgSQL body to avoid output-column name collisions.

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
    SELECT n.*
    INTO v_notification
    FROM public.notifications AS n
    WHERE n.complaint_id = p_complaint_id
      AND n.secure_link_id = p_secure_link_id
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

    SELECT c.*
    INTO v_complaint
    FROM public.complaints AS c
    WHERE c.id = v_notification.complaint_id
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
        UPDATE public.complaints AS c
        SET status = 'acknowledged',
            updated_at = now()
        WHERE c.id = v_complaint.id;

        UPDATE public.notifications AS n
        SET status = 'read',
            read_at = COALESCE(n.read_at, now())
        WHERE n.id = v_notification.id;

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

    UPDATE public.notifications AS n
    SET status = 'read',
        read_at = COALESCE(n.read_at, now())
    WHERE n.id = v_notification.id;

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
