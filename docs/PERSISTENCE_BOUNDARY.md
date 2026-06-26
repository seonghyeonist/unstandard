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

- `main`: reports use in-memory buffer (`lib/server/report-store.server.ts`) — **not alpha-safe**.
- Open PR #13: Supabase-coupled repository — **needs reframe** before merge (interface boundary first).
- Auth middleware uses Supabase SSR as an alpha auth adapter — existing; do not deepen without boundary review.
