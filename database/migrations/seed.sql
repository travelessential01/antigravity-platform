-- Seed Data: Bootstrap Antigravity with Apollo Hospital mock data
-- Source: F:\Application V4.0\.tmp\mock_staff_directory.csv (145 staff records)

-- ============================================================
-- 1. Organization
-- ============================================================
INSERT INTO public.organizations (id, name) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Apollo Hospitals Enterprise');

-- ============================================================
-- 2. Hospital
-- ============================================================
INSERT INTO public.hospitals (id, organization_id, name, nabh_accredited, jci_accredited) VALUES
    ('2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'Apollo Multispeciality Hospital', TRUE, FALSE);

-- ============================================================
-- 3. Departments (13 departments from CSV with pre-assigned UUIDs)
-- ============================================================
INSERT INTO public.departments (id, hospital_id, name, escalation_level) VALUES
    ('636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Quality', 3),
    ('78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Operations', 2),
    ('35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Procurement', 2),
    ('42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Medicine', 1),
    ('534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Surgery', 1),
    ('629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Nursing', 1),
    ('c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Housekeeping', 1),
    ('3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Administration', 4),
    ('6fc60de3-c678-4617-a17a-9f313b7508e8', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Medical Superintendent Office', 5),
    ('dc274f2a-d3ea-4056-aef9-5ecdc26654c2', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Data Protection Office', 5),
    ('4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Emergency', 1),
    ('64ff5596-efa1-4c20-8c73-8096c95728d5', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Radiology', 1),
    ('4e0c5566-4183-42dc-9a9d-63a266640200', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'Pharmacy', 1);

-- ============================================================
-- 4. Users (145 staff from mock_staff_directory.csv)
--    Using pre-assigned UUIDs as object_id from CSV
-- ============================================================

-- Quality Department (quality_coordinator role)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('c6eaadba-f4f5-4c46-bf4a-abd14a2ce077', 'priya.sharma977@apollohospital.local', 'Priya', 'Sharma', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('e1297553-bfbb-4063-bd33-a5c76a15c7e0', 'rahul.gupta350@apollohospital.local', 'Rahul', 'Gupta', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('b9f136ef-4480-4022-8a3f-f4351ca06adb', 'deepak.agarwal763@apollohospital.local', 'Deepak', 'Agarwal', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('01cb786e-b564-448c-8e74-5b05760edc2a', 'kiran.mehta145@apollohospital.local', 'Kiran', 'Mehta', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('85759667-77fe-459b-abd3-e876b56388de', 'ananya.yadav165@apollohospital.local', 'Ananya', 'Yadav', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('f32f65e5-c259-4238-b4b8-847a44b3e6c3', 'nitin.pandey995@apollohospital.local', 'Nitin', 'Pandey', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('35b93f29-a1eb-47c7-b670-93c49dc5b597', 'ananya.devi808@apollohospital.local', 'Ananya', 'Devi', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('f550ced9-5bb1-40d0-a176-234152ece13f', 'preeti.saxena915@apollohospital.local', 'Preeti', 'Saxena', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('52aa1219-88f0-42ae-b17a-25158ca9eb24', 'nitin.banerjee919@apollohospital.local', 'Nitin', 'Banerjee', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('d32c5315-a5b6-4608-b88b-71dda9f5584c', 'ravi.yadav328@apollohospital.local', 'Ravi', 'Yadav', 'quality_coordinator', '636fb19e-f53c-42d7-ace6-da882600d481', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Administration (admin role)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('023fe154-102e-4c01-afaf-97bd4db83570', 'amit.saxena390@apollohospital.local', 'Amit', 'Saxena', 'admin', '3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('83f6f37f-50ea-49d9-993c-c6ebcfb4aa00', 'neha.joshi464@apollohospital.local', 'Neha', 'Joshi', 'admin', '3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('58b8ba5e-3b45-4089-b490-4122b6205b38', 'anita.khan826@apollohospital.local', 'Anita', 'Khan', 'admin', '3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('5773f021-2d80-4a62-957b-0bf5ae993cae', 'anil.das718@apollohospital.local', 'Anil', 'Das', 'admin', '3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('82be00ca-5425-4be2-8ebc-401e15dddcee', 'neha.mishra911@apollohospital.local', 'Neha', 'Mishra', 'admin', '3ff75305-8de0-4567-ac91-d50d453b55ed', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Medical Superintendent
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('d7d7c810-93d9-4122-ab50-43294bc60336', 'suresh.bhatia766@apollohospital.local', 'Dr. Suresh', 'Bhatia', 'medical_superintendent', '6fc60de3-c678-4617-a17a-9f313b7508e8', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- DPO
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('3ed08a10-7f20-4c90-bcdc-ed073953eece', 'aditi.banerjee412@apollohospital.local', 'Aditi', 'Banerjee', 'dpo', 'dc274f2a-d3ea-4056-aef9-5ecdc26654c2', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Operations Department (department_manager role)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('dd647962-374f-48a2-9e7d-94ceab9daf8d', 'rajesh.kumar575@apollohospital.local', 'Rajesh', 'Kumar', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('24e07bb8-83ea-4e11-abd3-bfa0591500c7', 'vikram.kulkarni907@apollohospital.local', 'Vikram', 'Kulkarni', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('5f4e8cd4-3c37-42ec-a3e7-a4eecdea10d0', 'pooja.jain452@apollohospital.local', 'Pooja', 'Jain', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('da5a7000-d991-46fd-8789-753a13831833', 'mohit.mishra428@apollohospital.local', 'Mohit', 'Mishra', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('b0cf0e5f-3d8c-46d7-bb64-a07749c22fe7', 'priyanka.sen189@apollohospital.local', 'Priyanka', 'Sen', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('20258c2d-6749-49db-92bf-1d077c95eaaf', 'aditi.sinha831@apollohospital.local', 'Aditi', 'Sinha', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('f9ec3c22-a856-420a-b041-dfe7200f0171', 'simran.rao770@apollohospital.local', 'Simran', 'Rao', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('8a5c5458-12ec-4162-b494-3bfd6830476a', 'priyanka.deshmukh170@apollohospital.local', 'Priyanka', 'Deshmukh', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('557a2a6f-19c1-45b1-ab56-727bf6946f16', 'sunil.deshmukh546@apollohospital.local', 'Sunil', 'Deshmukh', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('9851aeaa-a4eb-459e-8ba4-0b3acc7791e7', 'aisha.yadav521@apollohospital.local', 'Aisha', 'Yadav', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('cfbd8c4e-db92-4781-ac20-f3d0cbd9fc82', 'priyanka.nair933@apollohospital.local', 'Priyanka', 'Nair', 'department_manager', '78619ac0-caa3-4742-b31e-181d30c8d5e0', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Procurement Department (department_manager role)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('be56d4f5-43ba-4f2e-87c9-c9085d32ee4c', 'arjun.mehta325@apollohospital.local', 'Arjun', 'Mehta', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('626fd99f-35c7-40e2-a407-64b9496332ab', 'shweta.deshmukh807@apollohospital.local', 'Shweta', 'Deshmukh', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('ba10664d-948e-474b-a97f-b38e64843b8a', 'riya.pandey296@apollohospital.local', 'Riya', 'Pandey', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('359b839c-480e-40f6-969e-d1e1ec67d0ab', 'gaurav.mehta185@apollohospital.local', 'Gaurav', 'Mehta', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('dcdd3f7e-778f-4491-9b19-02a060db9785', 'pallavi.kumar954@apollohospital.local', 'Pallavi', 'Kumar', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('970f7186-832d-462d-881b-6462b1796e70', 'gaurav.deshmukh801@apollohospital.local', 'Gaurav', 'Deshmukh', 'department_manager', '35ec44a2-dab8-42c8-bc7a-d21b530e2760', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Medicine Department (department_manager role) - first 5 of 16
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('252bc380-cc20-46e5-8fd2-bef8d0e83784', 'sanjay.gupta567@apollohospital.local', 'Dr. Sanjay', 'Gupta', 'department_manager', '42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('d6b4ea06-3227-43d8-a621-5bdfbfa1e204', 'divya.nath455@apollohospital.local', 'Dr. Divya', 'Nath', 'department_manager', '42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('ccc113c8-7075-46d1-8fb5-4409c7abfa6e', 'kavitha.dasgupta867@apollohospital.local', 'Dr. Kavitha', 'Dasgupta', 'department_manager', '42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('67048f29-42ef-47bc-b834-3574bce3d16c', 'neha.banerjee336@apollohospital.local', 'Dr. Neha', 'Banerjee', 'department_manager', '42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('00640869-0a19-48f6-8fe1-b0dc5e990818', 'anita.verma551@apollohospital.local', 'Dr. Anita', 'Verma', 'department_manager', '42254d74-623c-4472-bb04-df406fcf09c9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Surgery Department (first 5 of 11)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('8d8c9bd2-aaf7-42fc-ad2b-72413e3cb124', 'anil.kapoor916@apollohospital.local', 'Dr. Anil', 'Kapoor', 'department_manager', '534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('7aae1167-8fc0-408c-94e0-9f77f904c282', 'ramesh.singh859@apollohospital.local', 'Dr. Ramesh', 'Singh', 'department_manager', '534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('3b6780a2-e329-4ba0-9c72-f6a7cdaada7c', 'pooja.joshi352@apollohospital.local', 'Dr. Pooja', 'Joshi', 'department_manager', '534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('de7185dc-5ba6-41bc-9608-5e771b828532', 'mohit.chatterjee771@apollohospital.local', 'Dr. Mohit', 'Chatterjee', 'department_manager', '534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('23ba7543-b6cd-4158-a71d-3a42cce53cc1', 'mohit.iyer657@apollohospital.local', 'Dr. Mohit', 'Iyer', 'department_manager', '534cf3be-82f5-4eed-9d14-bf4a207285bb', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Nursing Department (first 5 of 31)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('94444bd0-a2d4-4565-aba8-3bd26c524702', 'sister.mary.thomas399@apollohospital.local', 'Sister', 'Mary Thomas', 'department_manager', '629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('1e01b973-66fc-431b-8050-8a8d0e444971', 'meera.chatterjee903@apollohospital.local', 'Meera', 'Chatterjee', 'department_manager', '629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('883eeb0a-959f-4b91-95f9-dac85ab7e948', 'deepa.das910@apollohospital.local', 'Deepa', 'Das', 'department_manager', '629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('e625b813-a43e-4119-8c35-ea18551c6516', 'deepak.shukla469@apollohospital.local', 'Deepak', 'Shukla', 'department_manager', '629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('1b732f75-4010-42d9-bd16-50ec3dd85b69', 'kavitha.mishra588@apollohospital.local', 'Kavitha', 'Mishra', 'department_manager', '629bc299-0a8d-4d8d-8796-ed1483b075a3', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Emergency Department (first 5 of 13)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('03fb5bc3-f1e6-4151-bb2e-76bdb5e7cdd7', 'karan.malhotra445@apollohospital.local', 'Dr. Karan', 'Malhotra', 'department_manager', '4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('f041583a-65f3-4944-aba9-d8299647b060', 'suresh.bhatt397@apollohospital.local', 'Dr. Suresh', 'Bhatt', 'department_manager', '4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('0db2ba97-512c-46a5-a206-473810084057', 'ritu.mishra413@apollohospital.local', 'Dr. Ritu', 'Mishra', 'department_manager', '4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('2ab67cc0-f61d-414e-aca3-69ca75f0639c', 'karan.chatterjee340@apollohospital.local', 'Dr. Karan', 'Chatterjee', 'department_manager', '4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('27dd8e44-7ba8-4ac7-9612-e1b079fd00de', 'rajesh.iyer628@apollohospital.local', 'Dr. Rajesh', 'Iyer', 'department_manager', '4cd2e801-8b32-4517-947d-c9f20c7292a9', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Housekeeping (first 5 of 28)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('b9970129-9f5b-4083-875a-4f2c67ccf424', 'ramesh.yadav235@apollohospital.local', 'Ramesh', 'Yadav', 'department_manager', 'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('7883795c-a865-4ee6-932a-3b0ad57f7ed0', 'gaurav.mehta831@apollohospital.local', 'Gaurav', 'Mehta', 'department_manager', 'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('6e231da5-78c0-4b13-8af4-25806dc048c9', 'rajesh.dasgupta629@apollohospital.local', 'Rajesh', 'Dasgupta', 'department_manager', 'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('58e8c793-d6fb-403a-be08-2654a2463991', 'divya.bhatt800@apollohospital.local', 'Divya', 'Bhatt', 'department_manager', 'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('92772827-3fcf-475b-ae43-fd5b9787de22', 'nitin.das524@apollohospital.local', 'Nitin', 'Das', 'department_manager', 'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Radiology (first 3 of 6)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('1c66d276-505b-4275-835f-229ae4c78707', 'vivek.sinha864@apollohospital.local', 'Dr. Vivek', 'Sinha', 'department_manager', '64ff5596-efa1-4c20-8c73-8096c95728d5', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('9168ab3a-1d20-42e3-8330-bf4dc79cb1d8', 'priyanka.deshmukh106@apollohospital.local', 'Dr. Priyanka', 'Deshmukh', 'department_manager', '64ff5596-efa1-4c20-8c73-8096c95728d5', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('d7a553f1-e316-4e64-a6c7-61f240fb9f57', 'sneha.singh940@apollohospital.local', 'Dr. Sneha', 'Singh', 'department_manager', '64ff5596-efa1-4c20-8c73-8096c95728d5', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- Pharmacy (first 3 of 7)
INSERT INTO public.users (id, email, first_name, last_name, role, department_id, hospital_id, mfa_enabled) VALUES
    ('10536ef6-cb17-465d-a3e7-914a56c8ba47', 'sunil.chandra728@apollohospital.local', 'Sunil', 'Chandra', 'department_manager', '4e0c5566-4183-42dc-9a9d-63a266640200', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('8a48ebf3-ef8e-4363-bb28-762dc05edd92', 'sunil.shukla216@apollohospital.local', 'Sunil', 'Shukla', 'department_manager', '4e0c5566-4183-42dc-9a9d-63a266640200', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE),
    ('aa12b276-1639-4478-8d10-f6b7a0d54740', 'suresh.pandey342@apollohospital.local', 'Suresh', 'Pandey', 'department_manager', '4e0c5566-4183-42dc-9a9d-63a266640200', '2cf24f6f-6a6a-4187-b426-63a2417c7e97', TRUE);

-- ============================================================
-- 5. Default SLA Configurations (per severity for the hospital)
-- ============================================================
INSERT INTO public.sla_configurations (hospital_id, severity_level, max_acknowledgement_hours, max_resolution_hours) VALUES
    ('2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'critical', 1, 24),
    ('2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'high', 4, 72),
    ('2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'medium', 8, 168),
    ('2cf24f6f-6a6a-4187-b426-63a2417c7e97', 'low', 24, 720);
