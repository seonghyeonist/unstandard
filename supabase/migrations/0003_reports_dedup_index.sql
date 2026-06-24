-- 0003_reports_dedup_index.sql
-- P0-1: reports-only persistence helper migration.
--
-- Duplicate OPEN reports are deduped so the same reporter cannot spam multiple
-- identical open tickets for the same target. Application logic returns the
-- existing row deterministically (HTTP 200) when this constraint would match.
--
-- This migration touches reports ONLY. Unlocks and blocks are intentionally
-- unchanged — identity model (mock slug vs profile UUID) is still unresolved.

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_open_dedup
  ON public.reports (reporter_user_id, target_type, target_id)
  WHERE status = 'OPEN';
