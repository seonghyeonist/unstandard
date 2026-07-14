# Legacy Backend Retirement

The previous hosted BaaS-backed backend (**Supabase** Auth + client/server SDK paths on `main`)
has been retired from the active runtime working tree on the rebuild branch.

Historical PRs (#53 and stacked branches) remain unmodified git records only.

For the full domain-by-domain cutover matrix (code vs schema vs external data/identity),
see the reviewed allowlisted cutover audit document
`docs/SUPABASE_TO_NEON_CUTOVER.md` (historical naming retained intentionally).

## What changed in active code

- Authentication is now self-hosted Better Auth with Drizzle persistence.
- Database is Neon PostgreSQL with server-only access.
- Authorization is enforced in application code and SQL constraints.
- Registration is invite-only for closed alpha.

## What was removed from active paths

- `@supabase/*` SDK imports in runtime code
- Browser-to-database access patterns
- Supabase Auth routes / callback wiring
- Legacy migration CLI wiring
- Legacy adversarial SQL smoke from the browser

## What is NOT claimed

- External Neon staging/production bootstrap complete
- Legacy user/data parity
- Production cutover
- Identity mapping completed
- Vector provider finalization

## Operator follow-up

1. Founder `DECISION_REQUIRED`: Option A (controlled migrate) vs Option B (clean reset) — see cutover doc
2. Provision Neon staging + production branches
3. Set Vercel Preview env per `docs/NEON_BOOTSTRAP_RUNBOOK.md` (no env mutation by agents without approval)
4. Run `npm run db:migrate` + `npm run db:seed` on staging
5. Run `npm run test:integration` with `TEST_DATABASE_URL`
6. Run `npm run smoke:authorization` on Preview
7. Build combined readiness evidence

`npm run guard:no-legacy-backend` PASS means active runtime/deployment paths do not depend on the retired platform — not that historical documentation cannot name it.
