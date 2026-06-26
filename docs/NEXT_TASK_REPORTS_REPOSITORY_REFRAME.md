# NEXT TASK: ReportsRepository Adapter Reframe

> **Status: IMPLEMENTED** (see adapter reframe PR). Kept for history.

This task reframed PR #13 salvage work behind `ReportsRepository`.

## What landed

- `lib/server/persistence/reports.types.ts` — backend-agnostic DTOs
- `lib/server/persistence/reports.repository.interface.ts` — interface
- `lib/server/persistence/reports.repository.factory.ts` — wiring only
- `lib/server/persistence/adapters/supabase/reports.repository.ts` — alpha adapter
- `app/api/reports/route.ts` — factory + HTTP mapper only

## Still alpha-blocked (human gates)

- Apply `0003_reports_dedup_index.sql` to staging
- RLS smoke on `reports`
- Reporter profile bootstrap before 409 path is live

## Next recommended task

See final PR report — typically **reporter profile bootstrap** or **RLS smoke checklist execution**, not more Supabase coupling.
