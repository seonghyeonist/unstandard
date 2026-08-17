# UNSTANDARD Alpha pre-recruitment verification — 2026-08-17

**Verdict:** `PRODUCTION_TECHNICAL_CUTOVER_PASS / LAUNCH_CLOSURE_IN_PROGRESS`

This note records the independent reconciliation and non-Production proof run
immediately before recruitment preparation. It is not a launch approval, a
Production readiness artifact, or an operational attestation.

## Exact source and GitHub

| Check | Observation | Result |
|---|---|---|
| Draft PR | [#75](https://github.com/seonghyeonist/unstandard/pull/75), open and draft | PASS (review surface remains non-merged) |
| Exact head | `c85176dc580136e4677f90d5b91e75e118f7a009` | PASS |
| Working tree after clone | clean | PASS |
| GitHub CI | `CI #140` for exact head | PASS |
| GitHub Rebuild CI | `Rebuild CI #85` for exact head | PASS |
| Review threads / PR discussion | none observed | PASS (no unresolved review blocker) |

An earlier subject SHA (`399677d…`) has a failed historical Rebuild CI. Its
failure was deterministic Drizzle schema drift: `drizzle-kit generate` created
an untracked `0007_foamy_freak` migration. It is not evidence against the
current head. The current-head history contains the explicit phantom-drift fix
and CI verifies it.

## Independent local replay

The exact head was cloned and checked without changing tracked source files.

| Command / check | Result |
|---|---|
| `drizzle-kit generate` then `git diff --exit-code -- drizzle lib/db/schema` | PASS — no schema changes |
| ESLint (`--max-warnings=0`) | PASS |
| `tsc --noEmit` | PASS |
| static/unit suite | 255 passed, 0 failed |
| Next.js production build | PASS; 20 routes generated |
| legacy-backend and import-boundary guards | PASS |

Network-dependent `npm audit` was not re-run from this shell. Exact-head
GitHub CI #140 ran both repository audit scripts successfully; the local result
above is intentionally not presented as a substitute for that CI evidence.

## Neon child identity and exact-head proof

All test mutations were restricted to the existing non-default child
`br-wild-smoke-ajcejshw`
(`disposable-founder-alpha-stage1-exact-66ec0ad-20260812`). The default/root
branch `br-bitter-wave-ajs8dy0u` was queried only for aggregate counts; it was
not migrated, seeded, reset, or otherwise written.

| Property | Observed value | Result |
|---|---:|---|
| Drizzle ledger rows | 7 | PASS |
| Ledger hashes | exact match to `0000`–`0006` manifest | PASS |
| Public tables | 22 | PASS |
| Users / profiles | 5 / 5 | PASS |
| Invite rows / legacy rows / Stage-1 rows | 12 / 12 / 0 | PASS |
| `alpha_stage1_capacity_guard` catalog entries | 2 event rows (one INSERT/UPDATE trigger) | PASS |
| Exact-head PostgreSQL integration | 17/17 tests; 27/27 required cases | PASS |
| Migration second run / fixture restoration | no-op / restored | PASS |
| Production parent after proof | 5 migrations; 17 tables; 5 users; 5 profiles; 12 invites | PASS (read-only, unchanged) |

The smoke runner's historical passwords did not match this child. Better Auth
returned `Invalid password`, falsifying the assumption that old branch-scoped
runner secrets were portable. Two credential hashes were therefore rotated on
this child only and the smoke was restarted. No user, profile, or invite row
was created or deleted. After the machine proof and browser drill, the child
intentionally contains two bidirectional unlock rows, two messages (one smoke
and one browser-drill message), and two reports. The synthetic waitlist entry
and its visit-day row were deleted, and Stage-1 invite count remains zero.

## Vercel exact-head Preview

Project `unstandard-m9qj` (`prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn`) is linked to
the `unstandard` team. Its current Production deployment remains
`dpl_HaswwnRTj85dUp4sRaLiZFrycJza` at historical main SHA
`da90853d28eaa77e71019f28f8f7e00cc3be7be4`.

The exact head is deployed as a non-Production Preview:

| Property | Observed value | Result |
|---|---|---|
| Deployment | `dpl_Fnv2B73EFR7XFuw5Vu6MWe3DmoE9` | READY |
| Git SHA / PR | `c85176dc580136e4677f90d5b91e75e118f7a009` / #75 | PASS |
| Branch | `agent/founder-resolution-alpha-stage1-20260812` | PASS |
| Stable Preview hostname | `unstandard-m9qj-git-agent-founder-resolution-c21239-unstandard.vercel.app` | PASS |
| Runtime | `database`; `DATABASE_ENV=staging`; Postgres reports adapter | PASS |
| Required auth configuration | URL, DB, Better Auth, cookie and app URL present | PASS |
| Safe DB fingerprint | `hostSha12=4041a24c7b12`; `neondb`; ledger checksum `6d4cf4db5f50a556` | PASS |
| Deployed HTTP smoke | 37/37 required cases | PASS |
| Combined readiness | integration 27/27 + smoke 37/37; digest `97b458d4c40f58de` | PASS |

The branch-scoped Preview variables do not change Production variables. During
automation, an operator token and a temporary Vercel share URL appeared in a
blocked command diagnostic. The branch-scoped operator token was immediately
rotated and the same SHA was redeployed. The current stable alias points to the
rotated deployment above. The leaked share URL is temporary (23-hour maximum)
and is not retained in this note. Core auth secrets and the database connection
string were not exposed.

The machine artifacts remain outside the PR branch to avoid self-referential
SHA chasing:

- `/tmp/unstandard-stage1-integration-c85176d.json`
- `/tmp/unstandard-stage1-smoke-c85176d.json`
- `/tmp/unstandard-stage1-readiness-c85176d.json`

## Credentialed browser drill

The founder approved the action-time scope for the exact Preview. The browser
drill then verified the following without touching Production, real invites,
account deletion, or domain settings:

| Browser check | Observation | Result |
|---|---|---|
| Waitlist consent | synthetic `example.com` address required explicit consent | PASS |
| Same-browser waitlist deletion | entry removed; child has 0 entries and 0 visit-day rows | PASS |
| A/B authentication | both temporary credential pairs reached authenticated routes | PASS |
| Profile and unlock | locked and already-unlocked states rendered distinctly | PASS |
| Message UI | one synthetic message rendered after send | PASS |
| Report UI | one new report changed the control to the disabled acknowledgement state | PASS |
| Logout UI | both authenticated sessions returned to the public surface | PASS |
| Child-side reconciliation | messages `1→2`, reports `1→2`, browser marker count 1 | PASS |
| Preview runtime after drill | no 5xx and no error/fatal log entries in the final 15-minute window | PASS |

The first report attempt targeted a row that already had an open report. The UI
showed the idempotent acknowledgement and the database count stayed at one.
Subsequent attempts under that user were rejected with HTTP 429 because the
earlier deployed smoke had already consumed the per-user report window. This
falsified the assumption that a successful-looking duplicate acknowledgement
proved a newly inserted row. A second approved test account, with an independent
rate-limit subject, created exactly one report against a different non-self
target; the child count then moved from one to two. The 429 responses were
expected policy enforcement, not 5xx runtime failures.

## Recruitment boundary

Recruitment is still prohibited until every founder/operation gate below is
closed:

- the approved Production migration and Git-linked Production deployment are
  now complete; see
  [`ALPHA_PRODUCTION_CUTOVER_20260817.md`](./ALPHA_PRODUCTION_CUTOVER_20260817.md).
  The operator-token-bound Production readiness artifact remains pending;

- acquired canonical non-Vercel domain with class-scoped trademark, handle, and
  spelling/pronunciation evidence. A Vercel re-check on 2026-08-17 reports
  `unstandard.app` available at USD 9.99/year and `unstandard.com` unavailable;
  its result contains no `.kr` or `.co.kr` data. This is not clearance, a
  purchase, or founder approval;
- the founder approved the Seoul-metro adult one-to-one romantic-conversation
  market and optional first-conversation roles on 2026-08-17. The separate
  consent contract is implemented in migration `0007` and must still pass
  exact-SHA CI, disposable Neon, and Production rollout;
- current support, moderation, privacy, waitlist lost-capability deletion,
  account-deletion, rollback, and restore drill references;
- a fresh, truthful four-trigger Neon Free observation and completed v4
  operator-local attestation; and
- separate explicit approval before any Production migration, deployment, or
  alias change.

When those gates pass, issue a small declared-metadata invite batch. The
50-person database cap is a maximum, not a launch batch size.
