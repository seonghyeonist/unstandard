# Alpha Readiness Checklist

## Verdict: BLOCKED

## P0 gates

- [ ] Neon staging + production branches provisioned separately
- [ ] `npm run db:migrate` + `npm run db:seed` on staging
- [ ] `npm run test:integration` with real `TEST_DATABASE_URL`
- [ ] `npm run smoke:authorization` on Preview with A/B users
- [ ] Invite-only registration verified end-to-end
- [ ] DB-backed reports, blocks, unlocks verified with authorization tests
- [ ] `npm run guard:no-legacy-backend` PASS
- [ ] `npm run readiness:alpha` PASS

## Completed in rebuild PR

- [x] Server-only Neon + Drizzle foundation
- [x] Better Auth sessions
- [x] Invite gate + profile bootstrap
- [x] Drizzle repositories for answers/reports/blocks/unlocks
- [x] Application authorization helpers

Do not claim alpha-ready until external DB + smoke evidence exists.
