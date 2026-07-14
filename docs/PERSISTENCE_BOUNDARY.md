# Persistence Boundary

Persistence code must stay behind repository interfaces.

```
Route / Server Action
  → domain service
    → repository interface
      → Drizzle repository
        → Neon PostgreSQL
```

Rules:

- Routes must not import Drizzle schema or Neon client directly.
- `UNSTANDARD_RUNTIME_MODE=database` + `DATABASE_URL` enables DB persistence.
- Preview/Production never select in-memory repositories.
- Migrations are committed SQL under `drizzle/migrations/`; apply with `npm run db:migrate`.
- Migration ledger location is shared via `lib/db/migration-contract.ts`
  (`drizzle.__drizzle_migrations`) — do not hardcode a divergent schema in tests.

## Relational vs vector infrastructure

- **Neon is the relational closed-alpha database.**
- Neon / pgvector is **not** automatically the permanent vector database.
- Depth Score remains behind a scoring interface.
- Embeddings remain behind a vector-store interface.
- Semantic retrieval remains behind a retrieval adapter.
- No UI or product route should import provider-specific vector primitives.
- pgvector may remain a PoC option; **no permanent vector provider is selected here**.

Platform cutover (active code vs external data/identity) is recorded in the
P0.3A platform cutover audit document under `docs/` (exact reviewed allowlist
filename only — see `docs/LEGACY_BACKEND_RETIREMENT.md`).

See `docs/DRIZZLE_MIGRATION_POLICY.md`.
