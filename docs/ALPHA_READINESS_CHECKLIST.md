# Alpha Readiness Checklist

## Verdict: STAGE1_NOT_READY (historical Production technical PASS; new contract unproved)

Alpha Stage 1 is **not** ready. Static quality gates alone never equal Alpha readiness.
A proof-harness combined readiness PASS is **not** the same as
overall closed-alpha launch readiness while other checklist gates remain open.

P0 was proven at exact PR head
`8223aca251d981965fea6fd1ef7de251bb5bbc5b` and merged by commit
`2cc3e88a12db316e4a0a5c94981de297e0420328`. The evidence recorded integration
`21/21`, deployed Preview authorization smoke `32/32`, combined readiness, and
`readiness:alpha` PASS. That closes the P0 proof harness; it does not prove the
merge commit's Production runtime or authorize a closed-alpha launch.

The historical P0 and 30-seat controls below are retained as provenance. The
authoritative current controls are in
`docs/CLOSED_ALPHA_STAGE1_RUNBOOK.md`. Until fresh exact-head evidence and every
v4 operational attestation pass, the product remains `STAGE1_NOT_READY`.

## Current 50-seat Stage 1 gates (2026-08-12)

- [x] Founder resolution translated into executable acceptance criteria
- [x] PostgreSQL-enforced 50-seat cap and five-cohort/acquisition metadata implemented
- [x] Persistent minimal messaging, question exposure, D7 activity, and waitlist revisit implemented
- [x] Privacy notice and account-deletion residual scope updated in code
- [x] KPI snapshot fails closed for immature samples and encodes Go / Conditional / No-Go reasons
- [x] Neon Capacity / Reliability / Operations / Data Risk trigger contract implemented
- [x] Alpha payment/subscription scope guard implemented
- [x] Exact-head Neon child proof on `br-wild-smoke-ajcejshw`: 17/17 tests, 27/27 required integration cases, seven-hash ledger, second-run no-op, fixture restoration, and Production-parent counts unchanged
- [x] Exact-head GitHub CI verified for `c85176dc580136e4677f90d5b91e75e118f7a009`: CI #140 and Rebuild CI #85 PASS
- [x] Branch-scoped Preview DB binding and redacted DB fingerprint match (`hostSha12=4041a24c7b12`)
- [x] Exact-head Vercel Preview `dpl_Fnv2B73EFR7XFuw5Vu6MWe3DmoE9` and 37/37 deployed HTTP smoke
- [x] Combined exact-head readiness artifact PASS (`27/27 + 37/37`; content digest `97b458d4c40f58de`)
- [x] Credentialed exact-Preview browser journey: A/B login, locked/unlocked profile rendering, one browser message, one new report, logout, and same-browser synthetic waitlist deletion; child reconciliation `messages 1→2`, `reports 1→2`, waitlist rows `0`
- [ ] Canonical domain four-part audit, acquisition, and DNS decision
- [x] Founder-approved role-based A/B definition and separate consent procedure (`stage1-role-preference-v1`); CLI + DB constraint implemented in migration `0007`
- [x] Migration `0007` diagnostic rehearsal on child `br-empty-rain-aj48sl58`; `5/5/12` preserved, ledger 8, constraint adversarial cases PASS (not exact-SHA launch authority)
- [x] Explicit Production migration approval and application on `br-bitter-wave-ajs8dy0u`; no seed; users/profiles/invites unchanged at `5/5/12`; seven exact hashes and empty rehearsal-child schema diff
- [ ] Git-linked Production deployment `dpl_6CADPoid6N3J6sHMMXUybejRMjYP` is READY at merge SHA `7198921788986aa954cecce6f0ac7aaeeeb35497`, browser/API/runtime observation passed, but operator-token-bound `operations:production:verify` artifact remains pending
- [ ] Current support, message/deletion, privacy, restore, rollback, moderation, and trigger evidence
- [ ] Operator-local attestation v4 and `operations:closed-alpha:gate` PASS
- [ ] Small-batch founder launch decision; never bulk-fill the 50-seat ceiling

## Founder data/identity decision

**OPTION B+ RECORDED** — clean reset with read-only archive policy.

- Do not migrate legacy hosted-BaaS application rows into the closed-alpha runtime.
- Do not delete legacy data in this workstream; archive separately if retention is required.
- Do not migrate legacy identities into Better Auth; new accounts + new invites only.
- Vercel automatically deployed the merge commit to Production; Production DB
  identity/readiness and operational cutover approval remain unproven.
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
- [x] Exact P0 head: `npm run test:integration` PASS artifact (`21/21`)
- [x] Exact P0 head: `npm run smoke:authorization` PASS artifact (`32/32` required)
- [x] Exact P0 head: combined evidence build + `readiness:alpha` PASS
- [x] Exact P0 head: Vercel Preview metadata maps to the subject SHA (`unstandard-m9qj`)
- [x] Invite-only registration verified end-to-end with Preview A/B accounts
- [x] DB-backed reports and unlock/private-profile authorization verified by integration + deployed HTTP smoke
- [x] DB-backed block persistence/uniqueness verified by PostgreSQL integration (no deployed block HTTP route claim)
- [ ] Legacy read-only archive created and verified **only if** retention is required (otherwise N/A; do not claim complete)
- [x] `npm run guard:no-legacy-backend` PASS at the snapshot-only head
- [ ] Fresh exact-SHA Production readiness artifact (`operations:production:verify`)
- [ ] Production Neon branch identity confirmed and either protected or covered by a passing v3 Free-plan closed-alpha exception
- [ ] Restore drill, incident/rollback/support/moderation/privacy/deletion/abuse attestations complete
- [ ] Closed-alpha operational gate PASS (`operations:closed-alpha:gate`)

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
