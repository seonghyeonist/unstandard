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

- Set `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` only after migration + RLS smoke (never by Supabase public env alone)
- Apply `0003_reports_dedup_index.sql` to staging
- RLS smoke on `reports`
- Reporter profile bootstrap before 409 path is live

### Reports identity contract (documented, not solved)

`reporterUserId` is currently `auth.users.id`. Requires `profiles.id === auth.users.id` or an adapter resolver before insert. See `PERSISTENCE_BOUNDARY.md`.

## Next recommended task

See final PR report — typically **reporter profile bootstrap** or **RLS smoke checklist execution**, not more Supabase coupling.
