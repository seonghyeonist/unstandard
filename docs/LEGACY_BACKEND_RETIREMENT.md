# Legacy Backend Retirement

The previous hosted BaaS-backed backend has been retired from the working tree.

Historical PRs (#53 and stacked branches) remain unmodified git records only.

## What changed

- Authentication is now self-hosted Better Auth with Drizzle persistence.
- Database is Neon PostgreSQL with server-only access.
- Authorization is enforced in application code and SQL constraints.
- Registration is invite-only for closed alpha.

## What was removed

- Vendor SDK imports in runtime code
- Browser-to-database access patterns
- Legacy migration CLI wiring
- Legacy adversarial SQL smoke from the browser

## Operator follow-up

1. Provision Neon staging + production branches
2. Set Vercel Preview env per `docs/NEON_BOOTSTRAP_RUNBOOK.md`
3. Run `npm run db:migrate` + `npm run db:seed` on staging
4. Run `npm run test:integration` with `TEST_DATABASE_URL`
5. Run `npm run smoke:authorization` on Preview
