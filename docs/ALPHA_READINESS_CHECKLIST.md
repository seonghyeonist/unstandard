# Alpha Readiness Checklist

## Verdict: BLOCKED_EXTERNAL

Alpha is **not** ready. Static quality gates alone never equal Alpha readiness.

## Proof tiers

1. **Static / unit / build** — lint, typecheck, unit tests, build, import/legacy guards
2. **Real PostgreSQL integration** — `npm run test:integration` + machine-generated artifact (`UNSTANDARD_INTEGRATION_EVIDENCE_OUT`)
3. **Deployed Preview HTTP smoke** — `npm run smoke:authorization` + machine-generated artifact (`UNSTANDARD_SMOKE_EVIDENCE_OUT`)
4. **Combined readiness** — `npm run readiness:evidence:build` → `npm run readiness:alpha`
5. **Future / not applicable** — e.g. DB-backed cross-user private-profile denial (mock route today)
6. **External unexecuted gates** — Neon credentials, real A/B Preview users, Vercel deployment SHA mapping

## P0 gates

- [ ] Neon staging + production branches provisioned separately
- [ ] `npm run db:migrate` + `npm run db:seed` on staging
- [ ] `npm run test:integration` with real `TEST_DATABASE_URL` → PASS artifact
- [ ] `npm run smoke:authorization` on Preview with A/B users → PASS artifact
- [ ] `npm run readiness:evidence:build` for the exact HEAD under test
- [ ] `npm run readiness:alpha` PASS against that combined artifact
- [ ] Operator confirms Vercel Preview deployment SHA maps to that HEAD (`unstandard-m9qj`)
- [ ] Invite-only registration verified end-to-end
- [ ] DB-backed reports, blocks, unlocks verified with authorization tests
- [ ] `npm run guard:no-legacy-backend` PASS

## Honest limitations (P0.2 / P0.2.1)

- Mock `GET /api/profile/[id]/private` is **not** Neon A/B ownership proof; HTTP 404 ≠ authz denial
- Local CookieJar clear ≠ server-side session revocation
- Case-name presence without `status: "PASS"` is not proof
- Manually edited PASS JSON is rejected
- `contentDigest` is not a cryptographic signature
- Runner git SHA alone does not attest the remote Vercel deployment SHA
- `migration_second_run_noop` requires DB ledger + schema fingerprint comparison (not repo file checksum)
- `seed_idempotency` exercises the shared `lib/db/seed-data.ts` path with state-idempotent `updated_at`
- External platform data/identity cutover remains `DECISION_REQUIRED` / `BLOCKED_EXTERNAL` (see P0.3A cutover audit)

## Node

Pinned to **Node 24.x** (`package.json` `engines`, CI `node-version: 24.x`).

## Completed in rebuild PR (code)

- [x] Server-only Neon + Drizzle foundation
- [x] Better Auth sessions
- [x] Invite gate + profile bootstrap
- [x] Drizzle repositories for answers/reports/blocks/unlocks
- [x] Application authorization helpers
- [x] P0.2 truthful proof harness (artifacts + session revocation distinction)
- [x] P0.2.1 migration ledger/schema second-run proof + shared seed idempotency + active-path legacy guard
- [x] P0.3A cutover audit document (external data/identity undecided)

Do not claim alpha-ready until external DB + Preview smoke + combined readiness + Vercel SHA mapping exist,
and founder decide Option A vs Option B for legacy identity/data.
