-- Migration 004: Create users table
-- Role as TEXT with CHECK constraint (no PostgreSQL ENUM to avoid migration pain)
-- auth_user_id references Supabase auth.users for SSO/JWT integration

CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    UUID UNIQUE,  -- references auth.users (linked at SSO provisioning time)
    email           TEXT NOT NULL,
    first_name      TEXT,
    last_name       TEXT,
    role            TEXT NOT NULL CHECK (role IN (
                        'patient',
                        'department_manager',
                        'quality_coordinator',
                        'admin',
                        'medical_superintendent',
                        'dpo'
                    )),
    department_id   UUID REFERENCES public.departments(id),  -- nullable for patients and org-level roles
    hospital_id     UUID REFERENCES public.hospitals(id),
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_users_hospital_id ON public.users(hospital_id);
CREATE INDEX idx_users_department_id ON public.users(department_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

COMMENT ON TABLE public.users IS 'Application users. Role stored as TEXT with CHECK. department_id nullable for patients/org-level roles.';
