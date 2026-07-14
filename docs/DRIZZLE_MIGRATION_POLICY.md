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

Integration `migration_second_run_noop` must compare this ledger and an application
schema fingerprint before/after a second identical migrate call. A repository
migration **file** checksum alone does **not** prove database no-op behavior.
Disposable `TEST_DATABASE_URL` evidence is not Neon Production evidence.
