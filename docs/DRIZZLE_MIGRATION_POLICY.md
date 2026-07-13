# Drizzle Migration Policy

- Schema source of truth: `lib/db/schema/*.ts`
- Generated / reviewed SQL: `drizzle/migrations/*.sql`
- Generate: `npm run db:generate` (review diff before commit)
- Apply: `npm run db:migrate` with `UNSTANDARD_CONFIRM_DB_MIGRATE=yes`
- Never run migrations during `npm run build`
- Never run `drizzle-kit push` against shared staging/production from CI
- Production apply requires `DATABASE_ENV=production` and explicit human approval
