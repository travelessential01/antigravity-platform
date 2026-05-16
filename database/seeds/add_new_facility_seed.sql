-- =============================================================================
-- Antigravity Platform — Add New Facility Seed
-- Use this template to onboard a new Organisation or Hospital
-- =============================================================================
-- INSTRUCTIONS:
-- 1. Replace the Organization UUID and Name.
-- 2. Replace the Hospital UUID and Name.
-- 3. Replace all instances of the old hospital UUID with the new one.
-- 4. Update Department Head / Manager UUIDs in Section 4.
-- 5. Run via: psql $DATABASE_URL -f database/seeds/add_new_facility_seed.sql
--
-- Note: This script adds data idempotently (ON CONFLICT DO NOTHING).
-- It does NOT wipe or delete existing data.
-- =============================================================================

BEGIN;

-- ===========================================================================
-- SECTION 1 — Organisation
-- ===========================================================================
INSERT INTO public.organizations (id, name)
VALUES ('d2f46abc-f4e1-4294-9ab8-f03799cccac9', 'Narayana Health')
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- SECTION 2 — Hospital
-- ===========================================================================
INSERT INTO public.hospitals (id, organization_id, name, nabh_accredited, jci_accredited)
VALUES (
    '903bade7-939c-4de5-b232-da988ac64591',
    'd2f46abc-f4e1-4294-9ab8-f03799cccac9',
    'Rabindranath Tagore International Institute for Cardiac Science',
    TRUE, TRUE
)
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- SECTION 3 — Departments
-- ===========================================================================
-- ANONYMOUS_DEPT_ID = 636fb19e-f53c-42d7-ace6-da882600d481
-- The intake server action prefers quality/patient-safety style departments for anonymous routing.
INSERT INTO public.departments (id, hospital_id, name, escalation_level)
VALUES
    ('636fb19e-f53c-42d7-ace6-da882600d481', '903bade7-939c-4de5-b232-da988ac64591', 'Quality & Patient Safety',     3),
    ('5ed930ce-88e8-451b-870e-50affcb799db', '903bade7-939c-4de5-b232-da988ac64591', 'Cardiology',                   1),
    ('043f1047-0542-4261-b40d-cf27abf1f99c', '903bade7-939c-4de5-b232-da988ac64591', 'Cardiac Surgery',              1),
    ('705bb82a-d63e-4e32-857d-0ee457c5fa3c', '903bade7-939c-4de5-b232-da988ac64591', 'Cardiac Critical Care (ICCU)', 1),
    ('2f7dd363-2c0a-441e-82bb-b1c1bfb64b8d', '903bade7-939c-4de5-b232-da988ac64591', 'Cardiac Rehabilitation',       1),
    ('9579b295-2bd1-45fa-a9cf-24bd27c0162b', '903bade7-939c-4de5-b232-da988ac64591', 'Emergency & Trauma',           1),
    ('d45328f1-e1dd-418f-ad3e-2f7202fe4752', '903bade7-939c-4de5-b232-da988ac64591', 'Radiology & Imaging',          1),
    ('dfe43524-2fa4-4988-a62a-10c1ea35f4a7', '903bade7-939c-4de5-b232-da988ac64591', 'Pharmacy',                     1),
    ('92edf6a1-112a-4e5a-8b51-3a0f8f7ce1fa', '903bade7-939c-4de5-b232-da988ac64591', 'Nursing Services',             1),
    ('a5bcb85c-9eb0-4aec-a8d7-4ea0248337a7', '903bade7-939c-4de5-b232-da988ac64591', 'Administration',               4),
    ('056e263f-9574-48ab-8324-8481926a0cf0', '903bade7-939c-4de5-b232-da988ac64591', 'Medical Superintendent Office', 5),
    ('00c60d93-9621-4475-901e-d97f905bb96b', '903bade7-939c-4de5-b232-da988ac64591', 'Data Protection Office',       5)
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- SECTION 4 — Essential Staff
-- ===========================================================================
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, phone, mfa_enabled)
VALUES
    ('c261f40b-2d74-4d6c-8d13-4772f33b7cb1', 'Arpan.Khanra@narayanahealth.org',   'Arpan',           'Khanra',         'admin',                 'a5bcb85c-9eb0-4aec-a8d7-4ea0248337a7', '903bade7-939c-4de5-b232-da988ac64591', '+919810000001', TRUE),
    ('371da5e0-c16e-48f0-883f-130fb88c3982', 'ms@narayanahealth.org',             'Medical',         'Superintendent', 'medical_superintendent', '056e263f-9574-48ab-8324-8481926a0cf0', '903bade7-939c-4de5-b232-da988ac64591', '+919810000002', TRUE),
    ('358f92cf-7ec7-4b1f-a9b1-4611c9b1223e', 'dpo@narayanahealth.org',            'Data Protection', 'Officer',        'dpo',                   '00c60d93-9621-4475-901e-d97f905bb96b', '903bade7-939c-4de5-b232-da988ac64591', '+919810000003', TRUE),
    ('ccf55b81-0f3a-49b5-8dc6-febdabb96a6f', 'qc.primary@narayanahealth.org',     'Quality',         'Coordinator',    'quality_coordinator',   '636fb19e-f53c-42d7-ace6-da882600d481', '903bade7-939c-4de5-b232-da988ac64591', '+919810000004', TRUE),
    ('b96d9fef-2f38-4a9f-b274-5796a76fbbfb', 'qc.secondary@narayanahealth.org',   'Quality',         'Coordinator II', 'quality_coordinator',   '636fb19e-f53c-42d7-ace6-da882600d481', '903bade7-939c-4de5-b232-da988ac64591', '+919810000005', TRUE),
    ('0978dcc6-9be2-49b5-ae99-509d4570b077', 'mgr.cardiology@narayanahealth.org', 'Cardiology',      'Manager',        'department_manager',     '5ed930ce-88e8-451b-870e-50affcb799db', '903bade7-939c-4de5-b232-da988ac64591', '+919810000006', TRUE),
    ('b905520a-bcbe-4942-9614-3c1d932f13d6', 'mgr.surgery@narayanahealth.org',    'Cardiac Surgery', 'Manager',        'department_manager',     '043f1047-0542-4261-b40d-cf27abf1f99c', '903bade7-939c-4de5-b232-da988ac64591', '+919810000007', TRUE)
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- SECTION 5 — SLA Configurations
-- ===========================================================================
INSERT INTO public.sla_configurations (hospital_id, department_id, severity_level, max_acknowledgement_hours, max_resolution_hours)
SELECT '903bade7-939c-4de5-b232-da988ac64591', NULL, 'critical', 1, 24
WHERE NOT EXISTS (SELECT 1 FROM public.sla_configurations WHERE hospital_id='903bade7-939c-4de5-b232-da988ac64591' AND department_id IS NULL AND severity_level='critical');

INSERT INTO public.sla_configurations (hospital_id, department_id, severity_level, max_acknowledgement_hours, max_resolution_hours)
SELECT '903bade7-939c-4de5-b232-da988ac64591', NULL, 'high', 4, 72
WHERE NOT EXISTS (SELECT 1 FROM public.sla_configurations WHERE hospital_id='903bade7-939c-4de5-b232-da988ac64591' AND department_id IS NULL AND severity_level='high');

INSERT INTO public.sla_configurations (hospital_id, department_id, severity_level, max_acknowledgement_hours, max_resolution_hours)
SELECT '903bade7-939c-4de5-b232-da988ac64591', NULL, 'medium', 8, 168
WHERE NOT EXISTS (SELECT 1 FROM public.sla_configurations WHERE hospital_id='903bade7-939c-4de5-b232-da988ac64591' AND department_id IS NULL AND severity_level='medium');

INSERT INTO public.sla_configurations (hospital_id, department_id, severity_level, max_acknowledgement_hours, max_resolution_hours)
SELECT '903bade7-939c-4de5-b232-da988ac64591', NULL, 'low', 24, 720
WHERE NOT EXISTS (SELECT 1 FROM public.sla_configurations WHERE hospital_id='903bade7-939c-4de5-b232-da988ac64591' AND department_id IS NULL AND severity_level='low');


-- ===========================================================================
-- SECTION 6 — On-Call Schedule
-- ===========================================================================
INSERT INTO public.on_call_schedules (hospital_id, department_id, user_id, shift_start, shift_end, is_primary_on_call)
SELECT '903bade7-939c-4de5-b232-da988ac64591', '636fb19e-f53c-42d7-ace6-da882600d481', 'ccf55b81-0f3a-49b5-8dc6-febdabb96a6f', NOW(), NOW() + INTERVAL '30 days', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.on_call_schedules WHERE department_id='636fb19e-f53c-42d7-ace6-da882600d481' AND is_primary_on_call=TRUE AND deleted_at IS NULL AND shift_end > NOW());

INSERT INTO public.on_call_schedules (hospital_id, department_id, user_id, shift_start, shift_end, is_primary_on_call)
SELECT '903bade7-939c-4de5-b232-da988ac64591', '636fb19e-f53c-42d7-ace6-da882600d481', 'b96d9fef-2f38-4a9f-b274-5796a76fbbfb', NOW(), NOW() + INTERVAL '30 days', FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.on_call_schedules WHERE department_id='636fb19e-f53c-42d7-ace6-da882600d481' AND user_id='b96d9fef-2f38-4a9f-b274-5796a76fbbfb' AND deleted_at IS NULL AND shift_end > NOW());

COMMIT;
