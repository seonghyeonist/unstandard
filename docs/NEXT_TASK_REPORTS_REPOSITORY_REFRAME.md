# NEXT TASK: ReportsRepository Adapter Reframe

> Planning note for the next implementation PR. **Not** a product feature — reframes open PR #13 to respect [`PERSISTENCE_BOUNDARY.md`](./PERSISTENCE_BOUNDARY.md).

## Title

`P0-1: ReportsRepository adapter reframe`

## Goal

Reframe PR #13 so reports persistence is backend-agnostic and Supabase is quarantined as an alpha/prototype adapter only.

## Required implementation

1. Define a generic `ReportsRepository` interface.
2. Define input/output types independent of Supabase (reuse `ReportRecord` shape where appropriate).
3. Move Supabase implementation to:
   - `lib/server/persistence/adapters/supabase/reports.repository.ts`
4. Route (`app/api/reports/route.ts`) imports only a factory or interface — no `@supabase/*`, no `.from("reports")` in route.
5. Preserve HTTP behavior:
   - unauthenticated → 401
   - invalid / self-report → 400
   - persistence disabled → 503
   - missing profile FK → 409
   - duplicate OPEN report → 200
   - new report → 201
   - generic DB failure → 500 (no internal error leakage)
6. Tests assert route/repository behavior, not Supabase internals.
7. No new product features.

## Salvage from PR #13

- `lib/server/persistence/reports.mapper.ts` — keep as pure mapping
- `lib/security/report-validation.ts` — `validateReportForUser`
- HTTP status mapping logic in route — keep, wire through interface
- `supabase/migrations/0003_reports_dedup_index.sql` — alpha-only; do not treat as sole schema truth

## Explicit non-goals

- No Supabase login UI
- No blocks
- No unlock DB source of truth
- No profiles/answers DB persistence
- No pgvector
- No Depth Score integration
- No matching
- No production architecture commitment to Supabase

## Verification (when implemented)

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm audit --audit-level=moderate
```

## Human gates after merge (still alpha-blocked)

- Apply migration to staging Supabase
- RLS smoke on reports table
- Reporter profile bootstrap exists before 409 path is exercised in prod
