# Drizzle Migration Policy

- Schema source of truth: `lib/db/schema/*.ts`
- Generated / reviewed SQL: `drizzle/migrations/*.sql`
- Generate: `npm run db:generate` (review diff before commit)
- Apply: `npm run db:migrate` with `UNSTANDARD_CONFIRM_DB_MIGRATE=yes`
- Never run migrations during `npm run build`
- Never run `drizzle-kit push` against shared staging/production from CI
- Production apply requires `DATABASE_ENV=production` and explicit human approval

## Migration ledger contract

Shared in `lib/db/migration-contract.ts` and consumed by `runDrizzleMigrations`:

- schema: `drizzle`
- table: `__drizzle_migrations`

Integration `migration_second_run_noop` must compare:

1. exact migration ledger rows
2. canonical schema snapshot (tables/columns/PKs/uniques/FKs with update·delete·deferrability, checks, indexes, enums, owned sequences, RLS flags, policies, non-internal triggers)
3. `schemaContentDigest` (SHA-256 of that canonical JSON — not a signature, not Production attestation)
4. required application table inventory

A repository migration **file** checksum alone does **not** prove database no-op behavior.
Disposable `TEST_DATABASE_URL` evidence is not Neon Production evidence.
