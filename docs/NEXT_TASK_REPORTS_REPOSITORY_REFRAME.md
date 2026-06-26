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

- Set `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` only after migration + RLS smoke
- Apply `0003_reports_dedup_index.sql` to staging
- RLS smoke on `reports` and `profiles` insert policy
- Staging smoke: authenticated report without 409 solely for missing profile row

### Reporter Profile Bootstrap (implemented)

`ensureReporterProfile` creates minimal `profiles` row (`id = auth.users.id`, nickname only) via Supabase alpha adapter when reports persistence is enabled.

## Next recommended task

See final PR report — typically **reporter profile bootstrap** or **RLS smoke checklist execution**, not more Supabase coupling.
