-- 0003_reports_dedup_index.sql
-- P0-1: reports-only alpha adapter migration (Supabase prototype).
--
-- Duplicate OPEN reports are deduped so the same reporter cannot spam multiple
-- identical open tickets for the same target. Application logic returns the
-- existing row deterministically (HTTP 200) when this constraint would match.
--
-- This migration touches reports ONLY. Unlocks and blocks are intentionally
-- unchanged — identity model (mock slug vs profile UUID) is still unresolved.
--
-- Preflight before apply (human): duplicate OPEN rows will make this index fail.
--   SELECT reporter_user_id, target_type, target_id, COUNT(*) AS n
--   FROM public.reports
--   WHERE status = 'OPEN'
--   GROUP BY 1, 2, 3
--   HAVING COUNT(*) > 1;
-- Resolve duplicates manually before running this migration.

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_open_dedup
  ON public.reports (reporter_user_id, target_type, target_id)
  WHERE status = 'OPEN';
