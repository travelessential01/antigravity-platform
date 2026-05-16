-- Migration 020: Materialised Views for Analytics (Zero PHI)
-- Hospital and Organisation level analytics aggregated without joining complaint_phi

-- 1. mv_avg_resolution_time
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_avg_resolution_time AS
SELECT
    c.hospital_id,
    AVG(EXTRACT(EPOCH FROM (h.created_at - c.created_at)) / 3600.0) AS avg_resolution_hours
FROM public.complaints c
JOIN public.complaint_status_history h
  ON c.id = h.complaint_id AND h.new_status = 'resolved'
GROUP BY c.hospital_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_avg_resolution_time_hospital ON public.mv_avg_resolution_time (hospital_id);

-- 2. mv_monthly_complaint_trends
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_monthly_complaint_trends AS
SELECT
    hospital_id,
    date_trunc('month', created_at) AS month,
    COALESCE(severity_level, 'unspecified') AS severity_level,
    COUNT(*) AS total_complaints
FROM public.complaints
GROUP BY hospital_id, date_trunc('month', created_at), COALESCE(severity_level, 'unspecified');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_trends_unique ON public.mv_monthly_complaint_trends (hospital_id, month, severity_level);

-- 3. mv_sla_compliance_percentage
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_sla_compliance_percentage AS
WITH total_complaints AS (
    SELECT hospital_id, COUNT(*) AS total
    FROM public.complaints
    GROUP BY hospital_id
),
breached_complaints AS (
    SELECT c.hospital_id, COUNT(DISTINCT b.complaint_id) AS breached
    FROM public.complaints c
    JOIN public.sla_breach_log b ON c.id = b.complaint_id
    GROUP BY c.hospital_id
)
SELECT
    t.hospital_id,
    t.total,
    COALESCE(b.breached, 0) AS breached,
    case when t.total > 0 then ROUND(((t.total - COALESCE(b.breached, 0))::numeric / t.total::numeric) * 100, 2) else 100.00 end AS compliance_percentage
FROM total_complaints t
LEFT JOIN breached_complaints b ON t.hospital_id = b.hospital_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sla_compliance_hospital ON public.mv_sla_compliance_percentage (hospital_id);

-- 4. mv_department_heatmap
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_department_heatmap AS
SELECT
    hospital_id,
    department_id,
    COUNT(*) AS total_complaints,
    COUNT(CASE WHEN status IN ('resolved', 'capa_validated', 'closed') THEN 1 END) AS resolved_complaints
FROM public.complaints
GROUP BY hospital_id, department_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_department_heatmap_unique ON public.mv_department_heatmap (hospital_id, department_id);

-- 5. mv_capa_effectiveness
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_capa_effectiveness AS
WITH capa_events AS (
    SELECT
        complaint_id,
        created_at AS capa_date
    FROM public.complaint_status_history
    WHERE new_status = 'capa_validated'
),
capa_complaints AS (
    SELECT
        ce.complaint_id,
        c.hospital_id,
        c.department_id,
        ce.capa_date
    FROM capa_events ce
    JOIN public.complaints c ON ce.complaint_id = c.id
)
SELECT
    cc.complaint_id AS capa_complaint_id,
    cc.hospital_id,
    cc.department_id,
    cc.capa_date,
    (SELECT COUNT(*) FROM public.complaints pre
     WHERE pre.department_id = cc.department_id
     AND pre.created_at >= (cc.capa_date - INTERVAL '30 days')
     AND pre.created_at < cc.capa_date) AS pre_30d_volume,
    (SELECT COUNT(*) FROM public.complaints post
     WHERE post.department_id = cc.department_id
     AND post.created_at > cc.capa_date
     AND post.created_at <= (cc.capa_date + INTERVAL '30 days')) AS post_30d_volume
FROM capa_complaints cc;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_capa_effectiveness_unique ON public.mv_capa_effectiveness (capa_complaint_id);

-- 6. mv_org_sla_compliance
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_org_sla_compliance AS
WITH total_org AS (
    SELECT h.organization_id, COUNT(c.id) AS total
    FROM public.complaints c
    JOIN public.hospitals h ON c.hospital_id = h.id
    GROUP BY h.organization_id
),
breached_org AS (
    SELECT h.organization_id, COUNT(DISTINCT b.complaint_id) AS breached
    FROM public.complaints c
    JOIN public.hospitals h ON c.hospital_id = h.id
    JOIN public.sla_breach_log b ON c.id = b.complaint_id
    GROUP BY h.organization_id
)
SELECT
    t.organization_id,
    t.total,
    COALESCE(b.breached, 0) AS breached,
    case when t.total > 0 then ROUND(((t.total - COALESCE(b.breached, 0))::numeric / t.total::numeric) * 100, 2) else 100.00 end AS compliance_percentage
FROM total_org t
LEFT JOIN breached_org b ON t.organization_id = b.organization_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_sla_compliance_unique ON public.mv_org_sla_compliance (organization_id);

-- 7. mv_org_complaint_trends
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_org_complaint_trends AS
SELECT
    h.organization_id,
    date_trunc('month', c.created_at) AS month,
    COALESCE(c.severity_level, 'unspecified') AS severity_level,
    COUNT(c.id) AS total_complaints
FROM public.complaints c
JOIN public.hospitals h ON c.hospital_id = h.id
GROUP BY h.organization_id, date_trunc('month', c.created_at), COALESCE(c.severity_level, 'unspecified');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_complaint_trends_unique ON public.mv_org_complaint_trends (organization_id, month, severity_level);

-- 8. mv_org_resolution_benchmarks
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_org_resolution_benchmarks AS
SELECT
    h.organization_id,
    c.hospital_id,
    AVG(EXTRACT(EPOCH FROM (h_res.created_at - c.created_at)) / 3600.0) AS avg_resolution_hours
FROM public.complaints c
JOIN public.hospitals h ON c.hospital_id = h.id
JOIN public.complaint_status_history h_res
  ON c.id = h_res.complaint_id AND h_res.new_status = 'resolved'
GROUP BY h.organization_id, c.hospital_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_resolution_benchmarks_unique ON public.mv_org_resolution_benchmarks (organization_id, hospital_id);

-- Permissions Setup
-- Admin & Medical Superintendent have access to org-level stats
-- Quality Coordinators & Department Managers have access to hospital-level stats
-- NOTE: In a real environment, you must GRANT SELECT on these views to the appropriate roles.
-- For now, we grant to authenticated and setup RLS logic in the Next.js API/Server Actions.
GRANT SELECT ON public.mv_avg_resolution_time TO authenticated;
GRANT SELECT ON public.mv_monthly_complaint_trends TO authenticated;
GRANT SELECT ON public.mv_sla_compliance_percentage TO authenticated;
GRANT SELECT ON public.mv_department_heatmap TO authenticated;
GRANT SELECT ON public.mv_capa_effectiveness TO authenticated;
GRANT SELECT ON public.mv_org_sla_compliance TO authenticated;
GRANT SELECT ON public.mv_org_complaint_trends TO authenticated;
GRANT SELECT ON public.mv_org_resolution_benchmarks TO authenticated;

-- RPC Function to safely trigger concurrent refresh of all materialized views from edge functions (Inngest)
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_avg_resolution_time;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_complaint_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_sla_compliance_percentage;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_department_heatmap;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_capa_effectiveness;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_org_sla_compliance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_org_complaint_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_org_resolution_benchmarks;
END;
$$;
