-- ============================================================================
-- FAQ System for Hospital Grievance Platform
-- Comprehensive FAQ management for admins with categories, ordering, and audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.faqs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    category        TEXT NOT NULL DEFAULT 'General',
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_published    BOOLEAN NOT NULL DEFAULT false,
    target_audience TEXT NOT NULL DEFAULT 'patient'
        CHECK (target_audience IN ('patient', 'staff', 'all')),
    tags            TEXT[] DEFAULT '{}',
    created_by      UUID REFERENCES auth.users(id),
    updated_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast category-based lookups
CREATE INDEX IF NOT EXISTS idx_faqs_hospital_category
    ON public.faqs(hospital_id, category);

-- Index for published FAQ retrieval (patient-facing)
CREATE INDEX IF NOT EXISTS idx_faqs_published
    ON public.faqs(hospital_id, is_published, sort_order);

-- Full-text search index on question + answer
CREATE INDEX IF NOT EXISTS idx_faqs_search
    ON public.faqs USING GIN (to_tsvector('english', question || ' ' || answer));

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_faq_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_faq_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_faq_timestamp();

-- RLS Policies
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to FAQs"
    ON public.faqs
    FOR ALL
    USING (
        (SELECT (auth.jwt() -> 'app_metadata' ->> 'app_role')) IN ('Admin', 'Quality Coordinator', 'Medical Superintendent')
    );

-- Published FAQs are readable by anyone (for patient-facing widget)
CREATE POLICY "Published FAQs are publicly readable"
    ON public.faqs
    FOR SELECT
    USING (is_published = true);

COMMENT ON TABLE public.faqs IS 'Centralized FAQ management for hospital grievance system. Supports categories, ordering, audience targeting, and full-text search.';
