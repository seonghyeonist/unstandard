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

See `docs/DRIZZLE_MIGRATION_POLICY.md`.
