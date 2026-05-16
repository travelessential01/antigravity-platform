-- ============================================================
-- Demo Seed: Rabindranath Tagore Institute for Cardiac Sciences
-- Purpose:   Client demonstration data
-- Run after: All migrations 001-039 and original seed.sql
-- Safe:      All INSERTs use ON CONFLICT DO NOTHING
-- ============================================================

-- Fixed UUIDs for easy reference in demos
-- Organization : 352d29ef-9a67-581c-baf8-595f0f53927a
-- Hospital     : 7434b5d2-087f-58ad-a9c8-1e4d48eae7dc
-- Departments  : f3f3f3f3-0000-0000-0000-00000000000{1-9}
-- Admin user   : b89293a5-9feb-5ab3-9480-5c22878d35ef
-- Med Supt     : e32058d8-8430-5e8a-a2be-93ae94dbfec4
-- QC lead      : 3f6f26a2-827e-5432-af53-6b245cfe4268
-- DPO          : 6b09acba-f978-5c68-a2d6-456cf5dd3ef4
-- Dept mgrs    : faaaaaa5..faaaaaa9
-- Demo patients: fbbbbbbb-0000-0000-0000-00000000000{1-5}

-- ============================================================
-- 1. Organization
-- ============================================================
INSERT INTO public.organizations (id, name) VALUES
    ('352d29ef-9a67-581c-baf8-595f0f53927a',
     'Tagore Medical Trust')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Hospital
-- ============================================================
INSERT INTO public.hospitals (id, organization_id, name, nabh_accredited, jci_accredited, address) VALUES
    ('7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     '352d29ef-9a67-581c-baf8-595f0f53927a',
     'Rabindranath Tagore Institute for Cardiac Sciences',
     TRUE, TRUE,
     '124, Mukundapur, EM Bypass, Kolkata - 700099, West Bengal, India')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Departments (10 clinical & administrative)
-- ============================================================
INSERT INTO public.departments (id, hospital_id, name, escalation_level) VALUES
    ('f0930665-ee3c-585d-98d5-9e58307feac8', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Cardiology',                      1),
    ('aa092dbb-92ab-56bb-a471-28ca71b3a981', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Cardiac Surgery',                 1),
    ('bc5b09ea-24a0-5821-8043-85217fdc9b88', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Cardiac Critical Care (ICCU)',    1),
    ('d1f0ef04-c390-5ad9-a163-c604b463117a', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Cardiac Rehabilitation',          2),
    ('73db419c-c411-5bc6-bf72-169bf401ebd3', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Nursing Services',                1),
    ('ea69e9b9-c0e4-595e-a647-61e455b05732', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Quality & Patient Safety',        3),
    ('95c0edd6-4e62-5218-b589-48eea30d0542', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Administration',                  4),
    ('ad0a43c3-e492-5357-ad66-5e39fd309a59', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Medical Superintendent Office',   5),
    ('df25d81a-0b47-561d-96e3-8686d1c54a65', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Data Protection Office',          5),
    ('abc90e3f-f435-5cdf-8973-1abbb98750ee', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'Emergency & Trauma',              1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Staff Users
-- ============================================================

-- Admin
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('b89293a5-9feb-5ab3-9480-5c22878d35ef', 'admin.rtiics@rtiics.local',
     'Arun', 'Bhattacharya', 'admin',
     '95c0edd6-4e62-5218-b589-48eea30d0542', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Medical Superintendent
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('e32058d8-8430-5e8a-a2be-93ae94dbfec4', 'supt.chakraborty@rtiics.local',
     'Dr. Subhas', 'Chakraborty', 'medical_superintendent',
     'ad0a43c3-e492-5357-ad66-5e39fd309a59', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Quality Coordinator (lead for demos)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('3f6f26a2-827e-5432-af53-6b245cfe4268', 'qc.sengupta@rtiics.local',
     'Pritha', 'Sengupta', 'quality_coordinator',
     'ea69e9b9-c0e4-595e-a647-61e455b05732', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE),
    ('65d5f788-cb09-5c67-8df4-ba98f45ac836', 'qc.mukherjee@rtiics.local',
     'Aniket', 'Mukherjee', 'quality_coordinator',
     'ea69e9b9-c0e4-595e-a647-61e455b05732', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE)
ON CONFLICT (id) DO NOTHING;

-- DPO
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('6b09acba-f978-5c68-a2d6-456cf5dd3ef4', 'dpo.bose@rtiics.local',
     'Tanmoy', 'Bose', 'dpo',
     'df25d81a-0b47-561d-96e3-8686d1c54a65', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Department Managers
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('d3a6f0ea-e548-5d7d-869f-382b7d40d9f4', 'dr.ghosh.cardio@rtiics.local',
     'Dr. Ranjit', 'Ghosh', 'department_manager',
     'f0930665-ee3c-585d-98d5-9e58307feac8', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE),
    ('9c3f8be6-ba7e-5fc7-8bfd-cd269bf1937d', 'dr.roy.surgery@rtiics.local',
     'Dr. Amitava', 'Roy', 'department_manager',
     'aa092dbb-92ab-56bb-a471-28ca71b3a981', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE),
    ('3456ef3f-c467-5173-a556-b6c5b040b222', 'dr.das.iccu@rtiics.local',
     'Dr. Sunanda', 'Das', 'department_manager',
     'bc5b09ea-24a0-5821-8043-85217fdc9b88', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE),
    ('8e82e214-d143-5e8b-9554-4fed31440b97', 'nursing.paul@rtiics.local',
     'Sr. Margaret', 'Paul', 'department_manager',
     '73db419c-c411-5bc6-bf72-169bf401ebd3', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Demo Patients (pseudonymous, zero real PHI)
-- ============================================================
INSERT INTO public.patients (id, hospital_id, contact_hash) VALUES
    ('15bfb6d0-e2aa-5809-bea1-f92ff26f474b', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', md5('seed:rtiics:patient.demo1@rtiics.local')),
    ('c1764c3d-2e90-52ee-81fb-4054ba002821', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', md5('seed:rtiics:patient.demo2@rtiics.local')),
    ('f7cc8488-a1b4-589b-844d-26c3fb7545c2', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', md5('seed:rtiics:patient.demo3@rtiics.local')),
    ('8cd762fa-a69d-51a5-86e1-029f3fc5645a', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', md5('seed:rtiics:patient.demo4@rtiics.local')),
    ('b90fe1ec-a08d-5855-b737-5ac905c67cbf', '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', md5('seed:rtiics:patient.demo5@rtiics.local'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. SLA Configurations (NABH/JCI compliant thresholds)
-- ============================================================
INSERT INTO public.sla_configurations (hospital_id, severity_level, max_acknowledgement_hours, max_resolution_hours) VALUES
    ('7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'critical',  1,   24),
    ('7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'high',       4,   72),
    ('7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'medium',     8,  168),
    ('7434b5d2-087f-58ad-a9c8-1e4d48eae7dc', 'low',       24,  720)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. GOLDEN complaint — full lifecycle for demo walk-through
--    Cardiac care complaint: billing error post-bypass surgery
-- ============================================================
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c',
     '15bfb6d0-e2aa-5809-bea1-f92ff26f474b',
     '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     'aa092dbb-92ab-56bb-a471-28ca71b3a981',   -- Cardiac Surgery
     'high', 'closed',
     NOW() - INTERVAL '45 days',
     NOW() - INTERVAL '42 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c',
     decode(md5('rtiics-demo-description-001'), 'hex'),
     decode(md5('rtiics-demo-reporter-001'),    'hex'),
     decode(md5('rtiics-demo-contact-001'),     'hex'))
ON CONFLICT (complaint_id) DO NOTHING;

-- Full lifecycle history
INSERT INTO public.complaint_status_history (complaint_id, previous_status, new_status, changed_by, created_at) VALUES
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', NULL,             'submitted',      NULL,                                     NOW() - INTERVAL '45 days'),
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', 'submitted',      'acknowledged',   'd3a6f0ea-e548-5d7d-869f-382b7d40d9f4', NOW() - INTERVAL '44 days 22 hours'),
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', 'acknowledged',   'investigating',  'd3a6f0ea-e548-5d7d-869f-382b7d40d9f4', NOW() - INTERVAL '44 days'),
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', 'investigating',  'resolved',       'd3a6f0ea-e548-5d7d-869f-382b7d40d9f4', NOW() - INTERVAL '40 days'),
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', 'resolved',       'capa_validated', '3f6f26a2-827e-5432-af53-6b245cfe4268', NOW() - INTERVAL '20 days'),
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c', 'capa_validated', 'closed',         '3f6f26a2-827e-5432-af53-6b245cfe4268', NOW() - INTERVAL '19 days')
ON CONFLICT DO NOTHING;

-- Consent (captured before PHI write)
INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('15bfb6d0-e2aa-5809-bea1-f92ff26f474b',
     '54098e06-f686-521b-a08d-2c2fb4a8dd5c',
     'v2.1-DPDP-2023', '10.10.1.1'::inet,
     NOW() - INTERVAL '45 days 2 minutes')
ON CONFLICT DO NOTHING;

-- CAPA sign-off audit log entry
INSERT INTO public.audit_logs (record_id, table_name, action_type, performed_by, old_data, new_data, created_at) VALUES
    ('54098e06-f686-521b-a08d-2c2fb4a8dd5c',
     'complaints', 'CAPA_SIGN_OFF',
     '3f6f26a2-827e-5432-af53-6b245cfe4268',
     '{"status": "capa_validated"}'::jsonb,
     '{"status": "closed", "capa_signed_by": "3f6f26a2-827e-5432-af53-6b245cfe4268", "capa_signature_type": "dual_signature"}'::jsonb,
     NOW() - INTERVAL '19 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. ACTIVE complaints across departments (visible on dashboard)
-- ============================================================

-- Critical: ICCU equipment complaint (SLA breaching — created 2h ago, 1h deadline)
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('c9ebd0e9-e846-5977-9986-2898f86608a5',
     'c1764c3d-2e90-52ee-81fb-4054ba002821',
     '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     'bc5b09ea-24a0-5821-8043-85217fdc9b88',   -- ICCU
     'critical', 'submitted',
     NOW() - INTERVAL '2 hours',
     NOW() - INTERVAL '1 hour')               -- already breached
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('c9ebd0e9-e846-5977-9986-2898f86608a5',
     decode(md5('rtiics-demo-description-002'), 'hex'),
     decode(md5('rtiics-demo-reporter-002'),    'hex'),
     decode(md5('rtiics-demo-contact-002'),     'hex'))
ON CONFLICT (complaint_id) DO NOTHING;

INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('c1764c3d-2e90-52ee-81fb-4054ba002821', 'c9ebd0e9-e846-5977-9986-2898f86608a5',
     'v2.1-DPDP-2023', '10.10.1.2'::inet, NOW() - INTERVAL '2 hours 1 minute')
ON CONFLICT DO NOTHING;

INSERT INTO public.sla_breach_log (complaint_id, breached_stage, escalated_to, created_at) VALUES
    ('c9ebd0e9-e846-5977-9986-2898f86608a5', 'acknowledgement',
     'e32058d8-8430-5e8a-a2be-93ae94dbfec4', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- High: Nursing complaint — in investigation
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('aec1d8d7-ef42-56ad-859c-1d317ca6a35c',
     'f7cc8488-a1b4-589b-844d-26c3fb7545c2',
     '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     '73db419c-c411-5bc6-bf72-169bf401ebd3',   -- Nursing
     'high', 'investigating',
     NOW() - INTERVAL '3 days',
     NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('aec1d8d7-ef42-56ad-859c-1d317ca6a35c',
     decode(md5('rtiics-demo-description-003'), 'hex'),
     decode(md5('rtiics-demo-reporter-003'),    'hex'),
     decode(md5('rtiics-demo-contact-003'),     'hex'))
ON CONFLICT (complaint_id) DO NOTHING;

INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('f7cc8488-a1b4-589b-844d-26c3fb7545c2', 'aec1d8d7-ef42-56ad-859c-1d317ca6a35c',
     'v2.1-DPDP-2023', '10.10.1.3'::inet, NOW() - INTERVAL '3 days 1 minute')
ON CONFLICT DO NOTHING;

-- Medium: Cardiology — acknowledged
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('a59a7557-1c9b-54a6-ba59-fa5bcd255735',
     '8cd762fa-a69d-51a5-86e1-029f3fc5645a',
     '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     'f0930665-ee3c-585d-98d5-9e58307feac8',   -- Cardiology
     'medium', 'acknowledged',
     NOW() - INTERVAL '1 day',
     NOW() + INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('a59a7557-1c9b-54a6-ba59-fa5bcd255735',
     decode(md5('rtiics-demo-description-004'), 'hex'),
     decode(md5('rtiics-demo-reporter-004'),    'hex'),
     decode(md5('rtiics-demo-contact-004'),     'hex'))
ON CONFLICT (complaint_id) DO NOTHING;

INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('8cd762fa-a69d-51a5-86e1-029f3fc5645a', 'a59a7557-1c9b-54a6-ba59-fa5bcd255735',
     'v2.1-DPDP-2023', '10.10.1.4'::inet, NOW() - INTERVAL '1 day 1 minute')
ON CONFLICT DO NOTHING;

-- Low: Cardiac Rehab — resolved, awaiting CAPA
INSERT INTO public.complaints (id, patient_id, hospital_id, department_id, severity_level, status, created_at, sla_deadline) VALUES
    ('89f012d2-72bb-542d-9b8d-7f6a196125a1',
     'b90fe1ec-a08d-5855-b737-5ac905c67cbf',
     '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc',
     'd1f0ef04-c390-5ad9-a163-c604b463117a',   -- Cardiac Rehab
     'low', 'resolved',
     NOW() - INTERVAL '10 days',
     NOW() + INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.complaint_phi (complaint_id, description, reporter_name, reporter_contact) VALUES
    ('89f012d2-72bb-542d-9b8d-7f6a196125a1',
     decode(md5('rtiics-demo-description-005'), 'hex'),
     decode(md5('rtiics-demo-reporter-005'),    'hex'),
     decode(md5('rtiics-demo-contact-005'),     'hex'))
ON CONFLICT (complaint_id) DO NOTHING;

INSERT INTO public.patient_consents (patient_id, complaint_id, consent_version, ip_address, consented_at) VALUES
    ('b90fe1ec-a08d-5855-b737-5ac905c67cbf', '89f012d2-72bb-542d-9b8d-7f6a196125a1',
     'v2.1-DPDP-2023', '10.10.1.5'::inet, NOW() - INTERVAL '10 days 1 minute')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Notifications for active complaints
-- ============================================================
INSERT INTO public.notifications (complaint_id, recipient_id, channel, status, created_at) VALUES
    ('c9ebd0e9-e846-5977-9986-2898f86608a5', 'e32058d8-8430-5e8a-a2be-93ae94dbfec4', 'in_app', 'sent',  NOW() - INTERVAL '1 hour'),
    ('c9ebd0e9-e846-5977-9986-2898f86608a5', '3f6f26a2-827e-5432-af53-6b245cfe4268', 'email',  'sent',  NOW() - INTERVAL '1 hour'),
    ('aec1d8d7-ef42-56ad-859c-1d317ca6a35c', '8e82e214-d143-5e8b-9554-4fed31440b97', 'in_app', 'read',  NOW() - INTERVAL '2 days 18 hours'),
    ('a59a7557-1c9b-54a6-ba59-fa5bcd255735', 'd3a6f0ea-e548-5d7d-869f-382b7d40d9f4', 'in_app', 'read',  NOW() - INTERVAL '20 hours'),
    ('89f012d2-72bb-542d-9b8d-7f6a196125a1', '3f6f26a2-827e-5432-af53-6b245cfe4268', 'email',  'read',  NOW() - INTERVAL '9 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verification: run these SELECTs to confirm seeding
-- ============================================================
-- SELECT name, nabh_accredited, jci_accredited FROM public.hospitals WHERE id = '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc';
-- SELECT name, escalation_level FROM public.departments WHERE hospital_id = '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc' ORDER BY escalation_level;
-- SELECT first_name, last_name, role FROM public.users WHERE hospital_id = '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc' ORDER BY role;
-- SELECT id, severity_level, status, sla_deadline FROM public.complaints WHERE hospital_id = '7434b5d2-087f-58ad-a9c8-1e4d48eae7dc' ORDER BY created_at DESC;
