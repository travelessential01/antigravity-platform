-- Migration 016: Indexing Strategy — fill gaps found by EXPLAIN ANALYZE
-- Generated after benchmarking 10K mock complaints

-- =============================================================
-- 1. complaints.assigned_to — Seq Scan detected on assigned_to lookup
--    EXPLAIN showed: Seq Scan filtering 10K rows for assigned_to queries
-- =============================================================
CREATE INDEX idx_complaints_assigned_to
    ON public.complaints (assigned_to, status, sla_deadline)
    WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

-- =============================================================
-- 2. complaints.sla_deadline — SLA breach scanner needs fast overdue lookup
--    Partial index for active (non-deleted, non-closed) complaints only
-- =============================================================
CREATE INDEX idx_complaints_sla_overdue
    ON public.complaints (sla_deadline ASC, department_id, status)
    WHERE deleted_at IS NULL AND status NOT IN ('closed', 'capa_validated');

-- =============================================================
-- 3. complaints.created_at DESC — dashboard sort optimization
--    Covers the ORDER BY created_at DESC in dashboard queries
-- =============================================================
CREATE INDEX idx_complaints_created_desc
    ON public.complaints (created_at DESC)
    WHERE deleted_at IS NULL;

-- =============================================================
-- 4. users soft-delete partial index — excludes deleted users from lookups
-- =============================================================
CREATE INDEX idx_users_active
    ON public.users (hospital_id, role, department_id)
    WHERE deleted_at IS NULL;

-- =============================================================
-- 5. complaint_phi.complaint_id — already UNIQUE, but add a covering index
--    for the JOIN pattern: complaints JOIN complaint_phi
-- =============================================================
-- (Not needed — the UNIQUE constraint on complaint_id already provides this)

-- =============================================================
-- 6. complaint_status_history — add index on changed_by for user activity
-- =============================================================
CREATE INDEX idx_status_history_changed_by
    ON public.complaint_status_history (changed_by, created_at DESC);

-- =============================================================
-- 7. notifications — pending notifications for delivery worker
-- =============================================================
CREATE INDEX idx_notifications_pending
    ON public.notifications (status, created_at)
    WHERE status = 'pending';

-- =============================================================
-- Verify all new indexes
-- =============================================================
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%' 
  AND indexname IN (
    'idx_complaints_assigned_to',
    'idx_complaints_sla_overdue',
    'idx_complaints_created_desc',
    'idx_users_active',
    'idx_status_history_changed_by',
    'idx_notifications_pending'
  )
ORDER BY tablename, indexname;
