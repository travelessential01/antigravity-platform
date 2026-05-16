-- Sprint 6 Seed Data: Comprehensive test data for chaos/security/DR/surveyor testing
-- Requires: All migrations 001-039 and original seed.sql applied first
-- Purpose: 200+ complaints, breaches, consents, and a "golden" complaint for Task 6.5
--
-- Schema Reference (from actual migrations):
--   complaints:              id, hospital_id, department_id, patient_id, assigned_to,
--                            parent_complaint_id, status, severity_level, sla_deadline, created_at, deleted_at
--   complaint_phi:           complaint_id, description(BYTEA), reporter_name(BYTEA), reporter_contact(BYTEA)
--   complaint_status_history: id, complaint_id, previous_status, new_status, changed_by, created_at
--   audit_logs:              id, table_name, record_id, action_type, old_data, new_data,
--                            performed_by, ledger_hash, previous_hash, ip_address, created_at
--   notifications:           id, recipient_id, complaint_id, channel, secure_link_id, status,
--                            delivered_at, read_at, created_at
--   sla_breach_log:          id, complaint_id, breached_stage, breach_timestamp, escalated_to, notes, created_at
--   patient_consents:        id, patient_id, complaint_id, consent_version, ip_address(INET),
--                            user_agent, consented_at, withdrawn_at
--   processed_events:        id, event_name, event_id, payload, created_at

-- ============================================================
-- Cross-tenant Hospital B (for Task 6.2 cross-tenant testing)
-- ============================================================
INSERT INTO public.hospitals (id, organization_id, name, nabh_accredited, jci_accredited) VALUES
    ('b75dcc6c-9ca2-563f-846e-4a25580b545d', '3b965436-838f-506e-a21c-f189e36a64ea',
     'Apollo Indraprastha Hospital', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, hospital_id, name, escalation_level) VALUES
    ('e3b2e849-14d2-5a3f-ab90-a1bf9b4ce561', 'b75dcc6c-9ca2-563f-846e-4a25580b545d', 'Cardiology', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('5f38774c-77a1-5d6c-881f-0bf35409358e', 'cross.tenant.manager@apolloindraprastha.local', 'Cross', 'Tenant Manager', 'department_manager', 'e3b2e849-14d2-5a3f-ab90-a1bf9b4ce561', 'b75dcc6c-9ca2-563f-846e-4a25580b545d', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Pseudonymous patients for complaint seeding
-- ============================================================
INSERT INTO public.patients (id, hospital_id, contact_hash) VALUES
    ('5d463797-c41a-5da3-b689-797f407baa94', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', md5('seed:apollo:patient.a001@example.com')),
    ('70088ce3-165b-54e2-8565-cfc7f2dd05e4', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', md5('seed:apollo:patient.b002@example.com')),
    ('85f9d873-4372-5da9-b252-19cf99827cc8', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', md5('seed:apollo:patient.c003@example.com')),
    ('289b966a-f9ad-5f75-8ad2-47083090c0d7', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', md5('seed:apollo:patient.d004@example.com')),
    ('3910bbf1-0141-5b39-b643-70c5d6bd3c1d', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', md5('seed:apollo:patient.e005@example.com'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- GOLDEN COMPLAINT for Task 6.5 Surveyor Dry Run
-- Full lifecycle: submitted → acknowledged → investigating → resolved → capa_validated → closed
-- ============================================================
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', '5d463797-c41a-5da3-b689-797f407baa94',
     '2cf24f6f-6a6a-4187-b426-63a2417c7e97', '42254d74-623c-4472-bb04-df406fcf09c9',
     'high', 'closed',
     NOW() - INTERVAL '90 days', NOW() - INTERVAL '87 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba',
     E'\\x0123456789abcdef0123456789abcdef',
     E'\\xfedcba9876543210fedcba9876543210',
     E'\\xaabbccdd11223344aabbccdd11223344')
ON CONFLICT (complaint_id) DO NOTHING;

-- Golden complaint status history (full lifecycle — 6 transitions)
INSERT INTO public.complaint_status_history (complaint_id, previous_status, new_status, changed_by, created_at) VALUES
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', NULL,              'submitted',      NULL,                                     NOW() - INTERVAL '90 days'),
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', 'submitted',       'acknowledged',   'dd647962-374f-48a2-9e7d-94ceab9daf8d', NOW() - INTERVAL '89 days 20 hours'),
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', 'acknowledged',    'investigating',  'dd647962-374f-48a2-9e7d-94ceab9daf8d', NOW() - INTERVAL '89 days'),
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', 'investigating',   'resolved',       'dd647962-374f-48a2-9e7d-94ceab9daf8d', NOW() - INTERVAL '85 days'),
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', 'resolved',        'capa_validated', 'c6eaadba-f4f5-4c46-bf4a-abd14a2ce077', NOW() - INTERVAL '55 days'),
    ('30b6403b-0543-5a3c-a9a5-fa78458138ba', 'capa_validated',  'closed',         'c6eaadba-f4f5-4c46-bf4a-abd14a2ce077', NOW() - INTERVAL '54 days');

-- Golden complaint consent record (captured BEFORE PHI written)
INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('5d463797-c41a-5da3-b689-797f407baa94', '30b6403b-0543-5a3c-a9a5-fa78458138ba',
     'v2.1-DPDP-2023', '192.168.1.100'::inet, NOW() - INTERVAL '90 days 1 minute')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Bulk Complaint Generation (~200 complaints)
-- NOTE: complaints table has NO category column
-- ============================================================
DO $$
DECLARE
    dept_ids UUID[] := ARRAY[
        '42254d74-623c-4472-bb04-df406fcf09c9',
        '534cf3be-82f5-4eed-9d14-bf4a207285bb',
        '629bc299-0a8d-4d8d-8796-ed1483b075a3',
        'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1',
        '4cd2e801-8b32-4517-947d-c9f20c7292a9',
        '78619ac0-caa3-4742-b31e-181d30c8d5e0',
        '35ec44a2-dab8-42c8-bc7a-d21b530e2760'
    ];
    severity_levels TEXT[] := ARRAY['critical', 'high', 'medium', 'low'];
    statuses TEXT[] := ARRAY['submitted', 'acknowledged', 'investigating', 'resolved', 'capa_validated', 'closed'];
    patient_ids UUID[] := ARRAY[
        '5d463797-c41a-5da3-b689-797f407baa94',
        '70088ce3-165b-54e2-8565-cfc7f2dd05e4',
        '85f9d873-4372-5da9-b252-19cf99827cc8',
        '289b966a-f9ad-5f75-8ad2-47083090c0d7',
        '3910bbf1-0141-5b39-b643-70c5d6bd3c1d'
    ];
    i INTEGER;
    comp_id UUID;
    dept_idx INTEGER;
    sev_idx INTEGER;
    stat_idx INTEGER;
    pat_idx INTEGER;
    base_ts TIMESTAMPTZ;
BEGIN
    FOR i IN 1..200 LOOP
        comp_id := gen_random_uuid();
        dept_idx := (i % array_length(dept_ids, 1)) + 1;
        sev_idx := (i % array_length(severity_levels, 1)) + 1;
        stat_idx := (i % array_length(statuses, 1)) + 1;
        pat_idx := (i % array_length(patient_ids, 1)) + 1;
        base_ts := NOW() - (random() * INTERVAL '180 days');

        INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline)
        VALUES (
            comp_id,
            patient_ids[pat_idx],
            '2cf24f6f-6a6a-4187-b426-63a2417c7e97',
            dept_ids[dept_idx],
            severity_levels[sev_idx],
            statuses[stat_idx],
            base_ts,
            base_ts + INTERVAL '72 hours'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact)
        VALUES (
            comp_id,
            decode(md5(random()::text), 'hex'),
            decode(md5(random()::text), 'hex'),
            decode(md5(random()::text), 'hex')
        ) ON CONFLICT (complaint_id) DO NOTHING;

        INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at)
        VALUES (
            patient_ids[pat_idx],
            comp_id,
            'v2.1-DPDP-2023',
            ('10.0.' || (i % 255)::text || '.' || ((i * 3) % 255)::text)::inet,
            base_ts - INTERVAL '1 minute'
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================================
-- SLA Breach Log entries (50+ records)
-- ============================================================
DO $$
DECLARE
    breach_ids UUID[];
    i INTEGER;
    comp_id UUID;
BEGIN
    SELECT ARRAY(
        SELECT id FROM public.complaints
        WHERE status IN ('investigating', 'resolved', 'closed')
        LIMIT 50
    ) INTO breach_ids;

    IF breach_ids IS NOT NULL AND array_length(breach_ids, 1) > 0 THEN
        FOR i IN 1..array_length(breach_ids, 1) LOOP
            comp_id := breach_ids[i];
            INSERT INTO public.sla_breach_log (complaint_id, breached_stage, escalated_to, created_at)
            VALUES (
                comp_id,
                CASE WHEN i % 2 = 0 THEN 'acknowledgement' ELSE 'resolution' END,
                CASE WHEN i % 3 = 0 THEN 'c6eaadba-f4f5-4c46-bf4a-abd14a2ce077'::uuid
                     ELSE 'dd647962-374f-48a2-9e7d-94ceab9daf8d'::uuid
                END,
                NOW() - (random() * INTERVAL '90 days')
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- ============================================================
-- Notification records for deep-link testing
-- notifications schema: recipient_id, secure_link_id is UUID
-- ============================================================
DO $$
DECLARE
    notif_ids UUID[];
    i INTEGER;
    comp_id UUID;
BEGIN
    SELECT ARRAY(
        SELECT id FROM public.complaints LIMIT 30
    ) INTO notif_ids;

    IF notif_ids IS NOT NULL AND array_length(notif_ids, 1) > 0 THEN
        FOR i IN 1..array_length(notif_ids, 1) LOOP
            comp_id := notif_ids[i];
            INSERT INTO public.notifications (
                complaint_id, recipient_id, channel, status, created_at
            ) VALUES (
                comp_id,
                'dd647962-374f-48a2-9e7d-94ceab9daf8d',
                CASE WHEN i % 3 = 0 THEN 'sms' WHEN i % 3 = 1 THEN 'email' ELSE 'in_app' END,
                CASE WHEN i % 2 = 0 THEN 'sent' ELSE 'read' END,
                NOW() - (random() * INTERVAL '30 days')
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- ============================================================
-- CAPA audit_log entry for the golden complaint (Task 6.5 Step 4)
-- Uses performed_by (not actor_id), action_type = CAPA_SIGN_OFF
-- ============================================================
INSERT INTO public.audit_logs (
    record_id, table_name, action_type, performed_by, old_data, new_data, created_at
) VALUES (
    '30b6403b-0543-5a3c-a9a5-fa78458138ba',
    'complaints',
    'CAPA_SIGN_OFF',
    'c6eaadba-f4f5-4c46-bf4a-abd14a2ce077',
    '{"status": "capa_validated"}'::jsonb,
    '{"status": "closed", "capa_signed_by": "c6eaadba-f4f5-4c46-bf4a-abd14a2ce077", "capa_signature_type": "dual_signature"}'::jsonb,
    NOW() - INTERVAL '54 days'
);

-- ============================================================
-- Verification query (uncomment to run):
-- ============================================================
-- SELECT 'complaints' as tbl, COUNT(*) as cnt FROM public.complaints
-- UNION ALL SELECT 'complaint_phi', COUNT(*) FROM public.complaint_phi
-- UNION ALL SELECT 'patient_consents', COUNT(*) FROM public.patient_consents
-- UNION ALL SELECT 'sla_breach_log', COUNT(*) FROM public.sla_breach_log
-- UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
-- UNION ALL SELECT 'complaint_status_history', COUNT(*) FROM public.complaint_status_history
-- UNION ALL SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;
