# UNSTANDARD Stage 1 Production cutover — 2026-08-17

**Verdict:** `PRODUCTION_TECHNICAL_CUTOVER_PASS / LAUNCH_GATES_OPEN`

This note records the approved Stage-1 schema migration and Git-linked
Production deployment. It is not a recruitment approval or a completed v4
operational attestation.

## Release identity

| Property | Observation | Result |
|---|---|---|
| Merged PR | `seonghyeonist/unstandard#75` | PASS |
| Verified PR head | `c85176dc580136e4677f90d5b91e75e118f7a009` | PASS |
| Production merge SHA | `7198921788986aa954cecce6f0ac7aaeeeb35497` | PASS |
| PR-head / merge tree | `fa9f7c11928fd997e0182bef7e78709c354b6c6c` / same | PASS |
| Main CI | GitHub Actions CI #141 | PASS |

## Neon Production migration

Target: project `raspy-fog-00907976`, default branch
`br-bitter-wave-ajs8dy0u` (`main`). No seed, reset, delete, drop, truncate, or
application-row update was performed.

Before applying Production, a fresh child
`br-floral-frog-ajyty7vz` (`preprod-stage1-c85176d-20260817`) was created from
the current parent. Reviewed migrations `0005` and `0006` plus their exact
Drizzle ledger rows were applied in one transaction. Rehearsal counts and
schema matched the expected contract.

| Check | Before | After | Result |
|---|---:|---:|---|
| Users / profiles / invites | 5 / 5 / 12 | 5 / 5 / 12 | PASS — unchanged |
| Public tables | 17 | 22 | PASS |
| Drizzle ledger rows | 5 | 7 | PASS |
| Missing / unexpected ledger hashes | n/a | 0 / 0 | PASS |
| Legacy / Stage-1 invites | n/a | 12 / 0 | PASS |
| Capacity trigger events / function | 0 / 0 | 2 / 1 | PASS |
| New message/activity/exposure/waitlist rows | n/a | all 0 | PASS — no seed |
| Rehearsal-child versus migrated-parent schema diff | n/a | empty | PASS |

Migration hashes:

- `0005`: `0f0575bae676144d2b70b27f74e3f04b8c8d0faa4a708dc93e6494670183f608`
- `0006`: `d2d1054723b2674651206d89939c952162c02ed2e00b636fddbed8a73320667a`

The pre-migration child is deliberately retained until the cutover evidence is
accepted. It must not be deleted merely because Production is currently
healthy.

## Vercel Production

| Property | Observation | Result |
|---|---|---|
| Deployment | `dpl_6CADPoid6N3J6sHMMXUybejRMjYP` | READY |
| Target / source | `production` / Git | PASS |
| Git SHA / branch | `7198921788986aa954cecce6f0ac7aaeeeb35497` / `main` | PASS |
| Production hostname | `unstandard-m9qj.vercel.app` | PASS as technical host only |
| Landing, login, privacy rendering | rendered from the new deployment | PASS |
| `GET /api/waitlist` | 200, `joined=false`, private/no-store | PASS |
| unauthenticated auth session | 401, `user=null`, private/no-store | PASS |
| unauthenticated candidates | 401 | PASS |
| post-deploy 5xx | none observed | PASS |
| post-deploy error/fatal logs | none observed | PASS |

The operator-only readiness route correctly returned 404 without its bearer
token. The current runtime can inspect deployments and logs through the
connected Vercel app but cannot list or replace Production environment secrets,
and no runtime `VERCEL_TOKEN` is present. Consequently
`operations:production:verify` has not produced a signed-off machine artifact.
The deployed runtime is operationally observed, but the release must not claim
the stronger `PRODUCTION_READINESS_ARTIFACT_PASS` state yet.

## Domain evidence

Fresh Vercel registrar lookup:

| Candidate | Observation |
|---|---|
| `unstandard.app` | available, USD 9.99 / one year |
| `unstandard.date` | available, USD 27 / one year |
| `unstandard.com` | unavailable |
| `unstandard.co` | unavailable |
| `unstandard.io` | unavailable |
| `.kr` / `.co.kr` | absent from the Vercel result; not adjudicated |

KIPRIS and WIPO provide the authoritative search surfaces, but the available
automation did not produce a class-scoped confusing-similarity result for the
mark. Social handle pages also could not be fetched reliably. Availability is
therefore not clearance. No domain was purchased or bound.

## Current Neon v4 observation

- Production branch remains `protected=false` with six-hour history.
- Project storage observation is about 36.3 MB against a reported 512 MiB
  branch logical-size limit; no capacity pressure is evident.
- Exact Production traffic after deployment produced no database-caused 5xx or
  fatal runtime signal.
- Operations and Data Risk cannot truthfully be marked false solely from those
  metrics. The founder must either accept the time-bounded v2 Free exception
  for the current 50-person risk or upgrade/protect before attestation.

## Remaining launch gates

1. Provide scoped Vercel Production secret access, rotate or retrieve the
   operator token without chat exposure, and run
   `operations:production:verify` against the exact Production SHA and safe DB
   fingerprint.
2. Acquire and bind one canonical domain only after class-scoped trademark,
   handle, and spelling/pronunciation review.
3. Deploy and verify the approved role-based A/B separate-consent contract in
   migration `0007`; approval alone does not substitute for exact-SHA proof.
4. Complete the operator-local v4 attestation with a fresh Free-risk decision,
   support/moderation/privacy/deletion/restore/rollback references, and the
   canonical-domain `/privacy` URL.
5. Run `operations:closed-alpha:gate`; only a PASS permits the first small
   invite batch.

## Consent-contract follow-up

The founder approved the role-based A/B market and separate consent procedure
on 2026-08-17. Migration `0007_alpha_balance_consent.sql` has SHA-256
`9a636c8b474ce6aeb81b20bc53a529d9cccc46df3b0d02db4e095abbdad8380b`.
It adds two nullable evidence columns and a CHECK that rejects counted A/B
without `stage1-role-preference-v1` plus a consent date, and rejects consent
metadata on `not_counted`.

The migration was rehearsed only on Neon child `br-empty-rain-aj48sl58`.
Before and after, users/profiles/invites remained `5/5/12`; the ledger became
8 rows; missing-consent A/B and consent-bearing `not_counted` inserts were
rejected; a valid B insert succeeded and was removed. Parent schema remains at
`0006` until the new exact SHA and CI are established.
