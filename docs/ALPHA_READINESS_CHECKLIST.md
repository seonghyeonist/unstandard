# Alpha Readiness Checklist

## Verdict: NOT_READY (proof harness previously PASS)

Alpha is **not** ready. Static quality gates alone never equal Alpha readiness.
A proof-harness combined readiness PASS is **not** the same as
overall closed-alpha launch readiness while other checklist gates remain open.

The runtime-tested parent `2d8203e5d81275030955c81d477b39d59e6d29b7`
has exact-SHA PASS evidence for real PostgreSQL integration (`21/21`), deployed
Preview authorization smoke (`32/32` required), and combined readiness. The
later snapshot-only head `a46bca48de20c8f28e852d32cac7b64660685b12` is
CI-green, but those parent artifacts are not relabeled as current-head proof.
After this documentation reconciliation, the final PR head must be deployed and
all three machine artifacts regenerated before the P0 merge decision.

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
5. **Launch / operations** — operator controls, retained-data decisions, rollout and Production cutover; not proven by the harness

## P0 gates

- [x] Founder Option B+ data/identity decision recorded (docs only; does not unblock external proofs)
- [x] Separate non-production Preview application DB and disposable integration DB observed
- [x] `npm run db:migrate` + `npm run db:seed` exercised on non-production targets
- [x] Runtime-tested parent: `npm run test:integration` PASS artifact (`21/21`)
- [x] Runtime-tested parent: `npm run smoke:authorization` PASS artifact (`32/32` required)
- [x] Runtime-tested parent: combined evidence build + `readiness:alpha` PASS
- [x] Runtime-tested parent: Vercel Preview deployment metadata maps to the subject SHA (`unstandard-m9qj`)
- [ ] Final PR head after documentation reconciliation repeats every exact-SHA proof above
- [x] Invite-only registration verified end-to-end with Preview A/B accounts
- [x] DB-backed reports and unlock/private-profile authorization verified by integration + deployed HTTP smoke
- [x] DB-backed block persistence/uniqueness verified by PostgreSQL integration (no deployed block HTTP route claim)
- [ ] Legacy read-only archive created and verified **only if** retention is required (otherwise N/A; do not claim complete)
- [x] `npm run guard:no-legacy-backend` PASS at the snapshot-only head
- [ ] Production cutover — `NOT_STARTED` (must remain so until explicitly authorized)

## Honest limitations (P0.2 / P0.2.1 / P0.2.2 / P0.2.3 / P0.3A)

- DB-backed private-profile and unlock authorization are active required HTTP cases; historical mock 404 evidence is not reused
- The deployed smoke proves A↔B unlock/private-profile isolation and report boundaries; it does **not** claim profile-mutation or block HTTP authorization
- Local CookieJar clear ≠ server-side session revocation
- Case-name presence without `status: "PASS"` is not proof
- Manually edited PASS JSON is rejected
- `contentDigest` / `schemaContentDigest` are not cryptographic signatures and do not attest Production
- Combined readiness artifact does **not** cryptographically bind Option B+; decision is repository/PR documentation at the same HEAD
- Runner git SHA alone does not attest the remote Vercel deployment SHA
- `migration_second_run_noop` requires DB ledger + canonical schema snapshot + `schemaContentDigest` (not repo file checksum); real run executes the repaired `pg_catalog` FK snapshot query
- `seed_idempotency` proves insert/update/no-op outcomes via `RETURNING` on a unique test-only dataset (default closed-alpha seed is not mutated for change proofs)
- Integration observation cleanup is guaranteed by try/finally without `process.exit` after log allocation; suites run serially (`--test-concurrency=1`, no shell glob)
- Session / private-profile / unlock JSON responses use private `no-store` Cache-Control (Artifact Version 2)
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

Do not claim closed-alpha launch readiness merely because the exact-head proof
harness passes. Remaining operational gates and Production cutover require a
separate decision. Missing credentials or unprovable target identity must still
produce `BLOCKED_EXTERNAL`, never an inferred PASS.
