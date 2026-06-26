# Persistence Boundary — Replaceable Storage

> Supabase is currently used as an **alpha/prototype persistence adapter**. It is **not** assumed to be the production backend. Persistence code must remain replaceable behind repository interfaces.

## Non-negotiable direction

- **Do not** bind Depth Score, semantic matching, embeddings, vector search, moderation, reporting, user state, or production persistence logic directly to Supabase APIs.
- **Do not** assume Supabase/pgvector is the long-term vector database.
- **Do not** write product/business logic that depends on Supabase-specific client patterns in routes or domain code.
- **Do not** treat Supabase SQL migrations as the only future schema source of truth.
- **Do not** present Supabase-backed persistence as production-ready architecture.

## Acceptable alpha use of Supabase

- Quick auth experiments (adapter layer only)
- CRUD proof-of-concept behind a repository interface
- Early operational persistence for closed-alpha validation
- Local/staging smoke with RLS as a temporary guardrail

## Required layering (target shape)

```
API route / server action
  → domain service (backend-agnostic)
    → ReportsRepository (interface)
      → SupabaseReportsRepository (alpha adapter, replaceable)
      → future: PostgresReportsRepository, HttpReportsService, etc.
```

Routes and domain code must depend on **interfaces and DTOs**, not on `@supabase/*` imports.

## PR review gate

Before merging persistence work, confirm:

1. Route does not import Supabase client directly.
2. Repository interface exists and is swappable in tests.
3. Adapter file path or name signals temporary alpha scope (e.g. `lib/server/persistence/adapters/supabase/`).
4. Docs/comments do not claim production architecture.
5. Tests assert HTTP/domain behavior, not Supabase SDK internals.

## Current state (honest)

- `POST /api/reports` uses `ReportsRepository` via factory — route is backend-agnostic.
- Supabase implementation lives under `lib/server/persistence/adapters/supabase/` (alpha adapter only).
- In-memory `report-store.server.ts` is deprecated and unused by the route.
- **50-person alpha still BLOCKED** until human applies migration + RLS smoke + reporter profile bootstrap.
- PR #13 remains draft/historical — superseded by adapter reframe PR; do not merge as-is.
- Auth middleware uses Supabase SSR as an alpha auth adapter — existing; do not deepen without boundary review.

## PR #13 status

Superseded by adapter-boundary reframe. Salvaged behavior preserved; Supabase code quarantined under `adapters/supabase/`.

## Reports persistence activation

Reports persistence must **not** be enabled by Supabase public env vars alone.

| `REPORTS_PERSISTENCE_ADAPTER` | Supabase URL + anon key | Enabled? |
|-------------------------------|-------------------------|----------|
| unset / `disabled` | any | **No** → 503 |
| `supabase-alpha` | missing | **No** → 503 |
| `supabase-alpha` | present | **Yes** (alpha adapter) |
| unknown value | any | **No** → 503 |

Set `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` only after migration apply, RLS smoke, and identity contract review.

### Reports identity contract

Reporter Profile Bootstrap (alpha adapter) ensures `profiles.id = auth.users.id` exists before reports insert when `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`.

- Minimal row: `id` + `nickname` only (no full profile system).
- Reporter Profile Bootstrap must not derive public/profile nicknames from email local-parts. If no nickname exists, use a non-identifying stable fallback such as `user-<uuid-prefix>`.
- Supabase adapter under `lib/server/profile/adapters/supabase/`.
- Route calls `ensureReporterProfile` — never `.from("profiles")` directly.

Self-report protection compares `targetId` to authenticated `user.id` (same as `profileId` under Option A).

**Alpha still BLOCKED** until migration apply, RLS smoke, and staging verification.
