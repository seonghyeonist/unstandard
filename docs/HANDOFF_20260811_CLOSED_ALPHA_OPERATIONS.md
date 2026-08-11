# Closed-alpha operations and security handoff — 2026-08-11

## Executive verdict

| Decision surface | Verdict | Evidence |
|---|---|---|
| Previously merged P0 code | `PASS` | Production remains on merge SHA `2cc3e88a12db316e4a0a5c94981de297e0420328`; this work does not reopen or redefine that decision. |
| Dependency security cleanup | `PASS` | Local full-tree and Production-only npm audit gates report 0 vulnerabilities; the Vercel Preview `npm ci` log also reports 0. |
| New readiness/gate implementation | `PASS` | 230/230 tests, 17/17 static pages, both GitHub Actions workflows, boundary guards, and exact remote-tree comparison passed. |
| Vercel Production readiness | `NOT_VERIFIED` | The new read-only operations endpoint is not deployed to Production and the Production Neon branch identity has not been proven. |
| Overall closed-alpha launch | `CLOSED_ALPHA_NOT_READY` | Production evidence and the independent operator attestation are both mandatory; neither may be inferred from a code/CI PASS. |

No Production deployment, Production database write, migration, seed, alias change,
or branch-protection mutation was performed in this work.

## Published review surface

- Draft PR: <https://github.com/seonghyeonist/unstandard/pull/67>
- Branch: `agent/closed-alpha-operational-readiness-20260811`
- Validated implementation commit: `b56bb5318b4faced9173533c29c24c4815a7d476`
- Validated Git tree: `c9fc3651e7fabd912c95291e6bd7cf0ed84ab39d`
- Preview deployment: `dpl_FQgb4fFAjpcgTyxvSyn2HQGpM2qF`
- Preview URL: <https://unstandard-m9qj-fjuxbwnp9-unstandard.vercel.app>

The Preview was created through the Vercel deployment API from the validated
runtime source set because this project did not automatically create a Git-linked
Preview for the API-updated branch. Vercel therefore does not expose a Git SHA in
that deployment's metadata. Source provenance is the local/remote tree equality
check recorded above; the deployment is suitable for build/UI verification, but
it is not a substitute for the exact-SHA Production evidence gate.

## Problems defined and resolved

### 1. P0 and launch authorization were conflated

Resolution:

- Added a read-only, authenticated Production readiness endpoint.
- Added a verifier that accepts only fresh, exact-SHA, exact-host Production
  evidence and writes a non-overwriting `0600` artifact.
- Added a second, independent closed-alpha gate for human operational checks.
- Corrected the readiness and security checklists so a repository PASS cannot
  authorize a launch.

### 2. Technical evidence was not bound to the deployed database

Resolution:

- The Production endpoint checks the Vercel/Node target, runtime/database modes,
  canonical origins, required server secrets, exact 40-hex release SHA, Neon
  connectivity, redacted DB host fingerprint, exact migration ledger, all 15
  application tables, `alpha.closed`, and the active unlock question.
- Responses and logs exclude connection strings, secrets, emails, user/profile
  identifiers, URLs, and application-row counts.
- The endpoint never migrates, seeds, or writes.

### 3. The observed npm audit debt had no independent gate

Resolution:

- Added narrow dependency overrides for affected transitive packages.
- Added separate Production and full tooling audit scripts.
- Added both audit gates to CI and rebuild CI.
- Added weekly npm and GitHub Actions Dependabot checks.

### 4. Closed-alpha operator obligations were implicit

Resolution:

- Added a fail-closed attestation schema for incident owner, support, rollback,
  restore, privacy, account deletion, moderation, rate-limit policy, cohort cap,
  and response time.
- Added evidence expiry, SHA matching, digest binding, and non-overwriting output.
- Checked-in example values are deliberately false; they are not an approval.

## Strict verification record

| Check | Result |
|---|---|
| `npm run check` | `PASS` — 230/230 tests, 52 suites, Next build 17/17 pages |
| `npm run audit:security` | `PASS` — 0 Production and 0 full-tree vulnerabilities |
| Vercel Preview `npm ci` audit | `PASS` — 425 packages installed, 426 audited, 0 vulnerabilities |
| Vercel Preview build | `PASS` — compile, TypeScript, 17/17 pages, readiness route present |
| GitHub `CI` run 122 | `PASS` on implementation commit |
| GitHub `Rebuild CI` run 68 | `PASS` on implementation commit |
| `npm run guard:no-legacy-backend` | `PASS` |
| `npm run guard:boundaries` | `PASS` |
| `npm run db:generate` | `PASS` — no schema delta |
| `git diff --check` | `PASS` |
| Local vs GitHub remote tree | `PASS` — both `c9fc3651e7fabd912c95291e6bd7cf0ed84ab39d` |
| Missing Production evidence/attestation | `PASS` — CLIs fail closed with exit 2 and create no artifact |
| Preview home page | `PASS` — browser rendered the closed-alpha landing page and login link |
| Preview unauthenticated readiness HTTP | `NOT_OBSERVED` — Preview Protection intercepted the request; fail-closed behavior is covered by unit tests, not claimed as deployed HTTP proof |

## Neon read-only observation

The non-default Preview branch `br-holy-sunset-ajo5h07n` in project
`raspy-fog-00907976` was queried read-only. No database mutation was performed.

- exact 2-entry Drizzle migration ledger present;
- 15 required public application tables present;
- `alpha.closed.enabled=true` present;
- expected unlock question active.

Observed migration content hashes:

- `0000_initial`: `6bd0717436006604b97990051420698cc9ccb43f222d695b5c1bfab750b3e39a`
- `0001_unlock_attempts`: `477391851311ec2dab554f806c953be5ec2e5d13859782fed2327f2ae01dc1d`

This Preview observation proves the query/check implementation against Neon; it
does not prove which branch Production uses. The observed Neon default branches
were also unprotected, which remains a launch blocker until the actual Production
root branch is explicitly identified and protected.

## Remaining launch blockers and owners

| Blocker | Required completion evidence | Suggested owner |
|---|---|---|
| PR not merged/deployed to Production | Approved merge and a Vercel Production deployment ID bound to the merged SHA | Engineering release owner |
| Production Neon identity unknown | Approved DB host fingerprint and explicit protected Production root branch | Database owner |
| Production preflight missing | Fresh `operations:production:verify` artifact for exact SHA/host/DB fingerprint | Release operator |
| Restore drill missing | Non-Production Neon point-in-time/history-branch recovery drill record | Database owner |
| Account deletion unproven | End-to-end verified user flow or documented operator procedure | Product/privacy owner |
| Rate-limit/abuse policy open | Implemented limits or explicitly reviewed cohort-bound alternative | Security/engineering owner |
| Support and moderation unassigned | Reachable channel, test message, named responder, response rule/SLA | Operations owner |
| Privacy notice not attested | Published current collection/retention/deletion notice | Product/privacy owner |
| Low real-traffic evidence | Post-first-user and per-batch Vercel error/5xx review | Release operator |

## Exact continuation procedure

1. Review Draft PR #67, including dependency overrides, endpoint redaction,
   evidence expiry, and the operator attestation contract.
2. Merge only after required review; record the resulting merge SHA.
3. Confirm the Vercel Production deployment ID and canonical hostname for that
   exact SHA. Do not run migration/seed from the build.
4. Identify and protect the actual Production Neon root branch. Record only its
   redacted host SHA-12 fingerprint in the readiness evidence.
5. Supply the operator token through the secret manager, then run:

   ```bash
   export UNSTANDARD_PRODUCTION_BASE_URL=https://unstandard-m9qj.vercel.app
   export UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA=<40-hex-production-sha>
   export UNSTANDARD_EXPECTED_PRODUCTION_DB_HOST_SHA12=<approved-sha12>
   export UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_OUT=/tmp/unstandard-production-readiness.json
   npm run operations:production:verify
   ```

6. Complete an operator-local copy of
   `config/closed-alpha-attestation.example.json` using real evidence. Keep it
   false until each item is proven.
7. Run the independent launch gate:

   ```bash
   export UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_PATH=/tmp/unstandard-production-readiness.json
   export UNSTANDARD_CLOSED_ALPHA_ATTESTATION_PATH=/secure/operator/closed-alpha-attestation.json
   export UNSTANDARD_CLOSED_ALPHA_GATE_OUT=/tmp/unstandard-closed-alpha-gate.json
   npm run operations:closed-alpha:gate
   ```

8. Launch only if both artifacts PASS and remain within their expiry windows.
   Start below the attested cohort cap, stop invitations first on degradation,
   and inspect Vercel runtime errors/5xx after the first real user and every batch.

## Rollback and recovery boundary

- Roll back only to a previously verified READY Vercel deployment, then rerun
  the Production preflight for the rolled-back SHA.
- For Neon recovery, create/query an isolated history branch first and prefer
  row-level recovery. Full restore overwrites schema/data and interrupts
  connections; it requires separate human approval and an incident record.
- Use pooled Neon connections for Vercel request workloads and direct
  connections only for migration/admin workflows that require session state.

The complete operator procedure is maintained in
`docs/CLOSED_ALPHA_OPERATIONS_RUNBOOK.md`.
