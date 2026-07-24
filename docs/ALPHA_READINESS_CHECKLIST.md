# Alpha Readiness Checklist

## Verdict: BLOCKED_EXTERNAL

Alpha is **not** ready. Static quality gates alone never equal Alpha readiness.
A proof-harness combined readiness PASS (if/when obtained) is **not** the same as
overall closed-alpha launch readiness while other checklist gates remain open.

## Founder data/identity decision

**OPTION B+ RECORDED** — clean reset with read-only archive policy.

- Do not migrate legacy hosted-BaaS application rows into the closed-alpha runtime.
- Do not delete legacy data in this workstream; archive separately if retention is required.
- Do not migrate legacy identities into Better Auth; new accounts + new invites only.
- Production cutover remains `NOT_STARTED`.
- See `docs/LEGACY_BACKEND_RETIREMENT.md` (points to the allowlisted P0.3A cutover audit).

This decision does **not** mark export, Preview bootstrap, smoke, or Production complete.

## Proof tiers

1. **Static / unit / build** — lint, typecheck, unit tests, build, import/legacy guards
2. **Real PostgreSQL integration** — `npm run test:integration` + machine-generated artifact (`UNSTANDARD_INTEGRATION_EVIDENCE_OUT`)
3. **Deployed Preview HTTP smoke** — `npm run smoke:authorization` + machine-generated artifact (`UNSTANDARD_SMOKE_EVIDENCE_OUT`)
4. **Combined readiness** — `npm run readiness:evidence:build` → `npm run readiness:alpha`
5. **Future / not applicable** — e.g. DB-backed cross-user private-profile denial (mock route today); DB-backed unlock HTTP authz
6. **External unexecuted gates** — disposable test DB, separate Preview DB, real A/B Preview users, Vercel deployment SHA mapping

## P0 gates

- [x] Founder Option B+ data/identity decision recorded (docs only; does not unblock external proofs)
- [ ] Neon staging (Preview) + production branches provisioned separately
- [ ] Disposable integration DB ≠ Preview application DB
- [ ] `npm run db:migrate` + `npm run db:seed` on Preview/staging only
- [ ] `npm run test:integration` with real `TEST_DATABASE_URL` → PASS artifact
- [ ] `npm run smoke:authorization` on Preview with A/B users → PASS artifact
- [ ] `npm run readiness:evidence:build` for the exact HEAD under test
- [ ] `npm run readiness:alpha` PASS against that combined artifact
- [ ] Operator confirms Vercel Preview deployment SHA maps to that HEAD (`unstandard-m9qj`)
- [ ] Invite-only registration verified end-to-end (new accounts under Option B+)
- [ ] DB-backed reports, blocks, unlocks verified with authorization tests
- [ ] Legacy read-only archive created and verified **only if** retention is required (otherwise N/A; do not claim complete)
- [ ] `npm run guard:no-legacy-backend` PASS
- [ ] Production cutover — `NOT_STARTED` (must remain so until explicitly authorized)

## Honest limitations (P0.2 / P0.2.1 / P0.2.2 / P0.2.3 / P0.3A)

- Mock `GET /api/profile/[id]/private` is **not** Neon A/B ownership proof; HTTP 404 ≠ authz denial
- Current deployed HTTP smoke matrix does **not** prove Neon-backed private-profile A-to-B denial, DB-backed unlock HTTP authz, profile mutation authz, or block HTTP authz
- Local CookieJar clear ≠ server-side session revocation
- Case-name presence without `status: "PASS"` is not proof
- Manually edited PASS JSON is rejected
- `contentDigest` / `schemaContentDigest` are not cryptographic signatures and do not attest Production
- Combined readiness artifact does **not** cryptographically bind Option B+; decision is repository/PR documentation at the same HEAD
- Runner git SHA alone does not attest the remote Vercel deployment SHA
- `migration_second_run_noop` requires DB ledger + canonical schema snapshot + `schemaContentDigest` (not repo file checksum); real run executes the repaired `pg_catalog` FK snapshot query
- `seed_idempotency` proves insert/update/no-op outcomes via `RETURNING` on a unique test-only dataset (default closed-alpha seed is not mutated for change proofs)
- Integration observation cleanup is guaranteed by try/finally without `process.exit` after log allocation; suites run serially (`--test-concurrency=1`, no shell glob)
- Session / private-profile / unlock JSON responses use private `no-store` Cache-Control (Artifact Version 1 wire shape unchanged; semantic expansion for `session_response_no_store`)
- Legacy guard PASS covers the printed inspected inventory only (exact historical allowlist + marker); not “zero historical mentions”

## Node

Pinned to **Node 24.x** (`package.json` `engines`, CI `node-version: 24.x`).

## Completed in rebuild PR (code / docs)

- [x] Server-only Neon + Drizzle foundation
- [x] Better Auth sessions
- [x] Invite gate + profile bootstrap
- [x] Drizzle repositories for answers/reports/blocks/unlocks
- [x] Application authorization helpers
- [x] P0.2 truthful proof harness (artifacts + session revocation distinction)
- [x] P0.2.1 migration ledger/schema second-run proof + shared seed idempotency + active-path legacy guard
- [x] P0.2.2 proof termination integrity, private no-store HTTP, serial integration, canonical schema snapshot, seed mutation outcomes, legacy-guard escape-hatch closure
- [x] P0.2.3 PostgreSQL FK schema snapshot query repair (`pg_constraint` + `unnest(conkey, confkey) WITH ORDINALITY`)
- [x] P0.3A cutover audit + **Option B+** founder decision recorded + proof env contract aligned

Do not claim alpha-ready until external DB + Preview smoke + combined readiness + Vercel SHA mapping exist,
and remaining P0 gates above are satisfied.

**INTERNAL PROOF CONTRADICTIONS:** repaired by P0.2.2 / P0.2.3 internal gates (unit/static). External proof remains `BLOCKED_EXTERNAL`.
