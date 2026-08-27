# Closed Alpha adversarial recursive review handoff — 2026-08-26

## Executive decision

**Verdict:** `CONDITIONAL / REATTESTATION_REQUIRED`

The product is no longer blocked by implementation, migration, domain purchase,
privacy mailbox, trademark screening, Korean spelling, or basic operations
drills. It is blocked only by the deliberate freshness contract: the last
token-bound Production artifact is older than six hours, so the operator must
regenerate it and rerun the same-SHA v4 gate immediately before invitations.

## Founder decision recorded

- English brand: `UNSTANDARD`
- Korean spelling: `언스탠다드`
- Canonical domain: `unstandard.app`
- Five-person spelling test: waived by founder for Stage 1
- Korea-only Stage 1 trademark disposition: `NO_BLOCKING_CONFLICT_FOUND`
- Overseas/41-class/merchandise expansion: counsel review required before use

## Evidence baseline

| Surface | Verified state |
|---|---|
| GitHub | `main` at `0c02fc3224eeec2fcc1cd9f622a44911e51282a5`; Vercel status success; PR-only main ruleset was previously verified |
| Vercel | Production `dpl_BQxZvNgk2kVZUD4rgp1dLgcQvj8V`, `READY`, exact SHA; zero grouped runtime errors over seven days |
| Neon | Project `raspy-fog-00907976`; Production `br-bitter-wave-ajs8dy0u`; 23 public tables plus nine-entry migration ledger; `legal_acceptances` present; users/profiles/invites remain `5/5/12` |
| Mail | `privacy@unstandard.app` delivered through ImprovMX to the founder Gmail; catch-all removed; minimum logs/7-day retention |
| Operations | support, moderation, account deletion residuals and isolated restore/reset drill passed on 2026-08-25 |
| Domain | acquired, bound, mailbox active, founder Instagram handle recorded, class-scoped screening complete |

## Adversarial recursion findings

### R1 — Documentation drift

`AGENTS.md`, the Stage 1 runbook and the readiness checklist still described an
August 12 pre-deployment state. An agent following them could repeat migrations
or select an obsolete rollback SHA. The documents now contain a dated override
and label older rows as provenance.

### R2 — Impossible global-clearance blocker

The previous handoff treated a worldwide counsel sign-off as necessary even
though the executable gate asks only whether a blocking conflict was found.
The corrected decision is scope-bound: Korea-only small Alpha passes; foreign
and adjacent expansion remains stopped.

### R3 — Korean spelling evidence mismatch

`언스탠다드` is not NIKL-identical to `스탠더드`. The correction avoids a false
standards claim and records the actual authority: intentional founder brand
choice with the proposed user test waived.

### R4 — Neon branch pressure

The Free plan permits 10 branches per project; eight were present. Five stale,
named disposable/preprod/old-restore branches were deleted after exact ID
resolution. Retained branches are Production, the 2026-08-25 pre-migration
recovery branch, and the current 0008 rehearsal branch. Branch occupancy fell
from 8/10 to 3/10.

Deleted branch IDs:

- `br-holy-sunset-ajo5h07n`
- `br-wild-smoke-ajcejshw`
- `br-floral-frog-ajyty7vz`
- `br-empty-rain-aj48sl58`
- `br-withered-art-ajxrkawb`

These deletions are not recoverable as branch objects. Production and the
latest recovery/rehearsal branches were not changed.

### R5 — Evidence freshness

Vercel/Neon live state remains healthy, but runtime observation is not a
substitute for the operator-token artifact. The six-hour expiry is functioning
as designed. Do not weaken it merely to turn the dashboard green. After applying
the founder domain disposition to the operator-local attestation, the official
gate was rerun: 9/10 passed, including `operational_evidence`; the only failure
was `TECHNICAL_EVIDENCE_STALE`.

### R6 — Dependency upgrades

Dependabot PR #70 is open and mergeable, but it groups Next.js, Better Auth,
React Query, React Hook Form and WebSocket updates. The current main audit was
previously clean. Do not merge this grouped release into the Alpha launch path
without a separate compatibility Preview and auth/invite/browser regression.

## Exact remaining procedure

1. Keep Production on the currently verified SHA unless this documentation PR
   is intentionally promoted.
2. Generate fresh `operations:production:verify` evidence using the current
   Vercel operator token; do not expose the token.
3. Copy the v4 attestation and set the domain values exactly as mapped in
   `BRAND_DECISION_UNSTANDARD_20260826.md`; refresh `reviewedAt`, Neon trigger
   observation, restore reference and exception acceptance timestamps.
4. Run `operations:closed-alpha:gate` against the same SHA and host.
5. Require 10/10 PASS, then record `SHIP_SMALL_BATCH` and issue only 6–10
   founder-network invites. Do not pre-fill the 50-seat ceiling.
6. During invitation activity, review support/reports, 5xx, DB reliability,
   deletion availability and supply balance daily; pause on any P0 failure.

## Repository verification

- ESLint: PASS
- TypeScript: PASS
- unit/contract tests: PASS (`260/260`)
- Next.js Production build: PASS (`22/22` pages)
- `guard:no-legacy-backend`: PASS (`207` active files, `0` findings)
- `guard:boundaries`: PASS
- Production dependency audit, moderate+: PASS (`0` vulnerabilities)
- Full dependency audit, high+: PASS (`0` vulnerabilities)
- Current operational gate after founder disposition: 9/10; only
  `TECHNICAL_EVIDENCE_STALE` fails

## Non-blocking deferred work

- PR #70 dependency compatibility review
- Local AI/human-label/calibration work; not Alpha authority
- staged quantitative/photo reveal; Beta-prep only
- trademark filing strategy and overseas counsel
- Neon paid-plan review when any capacity/reliability/operations/data-risk
  trigger becomes true

## Rollback

This review changes repository documentation only. Revert its single commit to
restore the prior wording. The Neon branch deletions cannot be reverted as
branch objects; recreate fresh children from Production when new rehearsals are
needed.
