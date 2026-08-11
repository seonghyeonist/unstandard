# Legacy Backend Retirement

status: HISTORICAL_AUDIT_NOT_EXECUTABLE

The previous hosted BaaS-backed backend (**Supabase** Auth + client/server SDK paths on `main`)
has been retired from the active runtime working tree on the rebuild branch.
This file is a reviewed historical audit only — not executable operator instructions.

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

1. Founder decision **OPTION B+ RECORDED** (clean reset + read-only archive) — see cutover doc; do not migrate legacy rows/identities
2. Provision separate disposable integration DB + Preview application DB (never one DB for both)
3. Set Vercel Preview env per `docs/NEON_BOOTSTRAP_RUNBOOK.md` (no Production env mutation)
4. Run `npm run db:migrate` + `npm run db:seed` on Preview/staging only
5. Run `npm run test:integration` with disposable `TEST_DATABASE_URL`
6. Run `npm run smoke:authorization` on Preview (bypass required if protection enabled)
7. Build combined readiness evidence
8. Production cutover remains `NOT_STARTED` until explicitly authorized

`npm run guard:no-legacy-backend` PASS means active runtime/deployment paths in the
**printed inspected inventory** do not depend on the retired platform — not that
historical documentation cannot name it. Historical allowlisted audits must include
`status: HISTORICAL_AUDIT_NOT_EXECUTABLE` and must not be treated as executable runbooks.
