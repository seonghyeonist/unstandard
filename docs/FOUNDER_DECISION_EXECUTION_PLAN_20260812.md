# Founder Decision execution plan — 2026-08-12

## Decision under test

UNSTANDARD moves from engineering-readiness work to a founder-led Closed Alpha
experiment. Stage 1 is capped at 50 registered participants and has a maximum
observation window of six weeks. Stage 2 (100–200 participants), Neon paid-plan
spend, and user monetization remain separate later decisions.

This plan translates the Founder Decision Proposal v0.1 into executable product,
data, and operating contracts. It does not treat a passing build as market proof.

## Source precedence

When source documents disagree, use this order:

1. MVP Master Spec v4.2 for current product KPI thresholds and the
   Go / Conditional Go / No-Go decision rule.
2. AI Agent Harness & Online Marketing Playbook v0.1 for the 50-person,
   five-cohort recruitment design and the prohibition on pre-alpha payments.
3. Alpha/Beta Target & Staged Reveal Change Note v0.1 for acquisition metadata
   and the rule that staged reveal remains disabled in Alpha.
4. Founder Decision Proposal v0.1 for decision sequencing and spend triggers.
5. v4.1 only as historical context.

The supplied labeling dataset remains unchanged and is not a source for the
founder decision.

## Baseline contradiction register

| Claim at baseline | Observed implementation | Consequence |
| --- | --- | --- |
| Stage 1 is 50 people | Operational attestation hard-codes a 30-person Neon Free exception | A 50-person launch cannot inherit the old PASS artifact. |
| Alpha has a hard cap | Invite creation inserts without an atomic capacity check | Parallel operator actions can over-issue seats. |
| Five cohorts are measurable | Invite rows contain no cohort or acquisition metadata | Cohort quality cannot be compared. |
| D7 and first-message quality decide Go | Activity is not durably recorded and chat is process-local mock data | The stated Go decision is not computable. |
| Gender/supply balance is an operating gate | No consented balance attribute or gate exists | The product must not claim automated gender gating. Founder-managed supply control remains a manual prerequisite. |
| Production is ready | Current handoff says Production was verified; `AGENTS.md` still says BLOCKED | Status documents must be reconciled to dated evidence. |

## Work packages and acceptance criteria

### WP1 — Stage 1 policy and atomic admission

- Define one canonical 50-seat / six-week policy and five recruitment cohorts.
- Add cohort, acquisition channel, target phase, and a privacy-minimizing operator
  `balance_bucket` to invite records.
- Classify all pre-migration invitations as `legacy_pre_stage1`; keep historical
  accounts working but exclude them from the new cap and market KPI population.
- Create invitations only inside a transaction holding a PostgreSQL advisory
  transaction lock; count pending, reserved, and consumed Stage 1 seats before
  insert; reject seat 51.
- Preserve the existing atomic reserve/consume contract and make registration
  fail closed if the Stage 1 policy is unavailable.
- Do not infer or collect a user's gender in the application. `balance_bucket`
  is an opaque A/B/not-counted operating label; the founder must document the
  relevant matching market and obtain any necessary consent outside this patch.

### WP2 — Durable core-behaviour evidence

- Replace the database-runtime chat stub with a minimal persistent message path.
- Require an authenticated, onboarded actor, a real target profile, an existing
  unlock relationship, no block in either direction, body validation, and a
  shared database rate limit.
- Record one privacy-minimized activity row per user per UTC day from core
  authenticated product access. Store no exact activity time, URL, answer,
  message, IP, or user-agent in the activity table.
- Delete messages and activity on account deletion; remove residual reports that
  target deleted messages.
- Keep mock runtime only for local development and never use it as Alpha KPI
  evidence.

### WP3 — KPI snapshot and decision semantics

- Provide a read-only operator command that reports denominator, numerator,
  observation maturity, and status for onboarding, first blur unlock time,
  question response, first-message length, D7 activity, channel D7, cohort
  recruitment, and balance-bucket supply.
- Mark unavailable or immature metrics `INSUFFICIENT_DATA`; never coerce them to
  zero or PASS.
- Implement privacy-minimized waitlist revisit measurement with affirmative
  consent and a deletion capability. Keep Fast-track depth explicitly
  `NOT_IMPLEMENTED`; never substitute the deterministic local heuristic for it.
- Implement Go only when the four product lower-bound metrics have at least three
  passes, one acquisition channel has mature D7 at or above 45%, and waitlist
  revisit is measured at or above 25%. Conditional Go and No-Go must expose their
  reasons rather than collapse into a single score.

### WP4 — Infrastructure and founder gates

- Supersede the 30-person exception. A 50-person Free-plan attestation must be a
  new artifact with current project/branch identity, expiry, restore evidence,
  quota/recovery pause controls, and founder acceptance. No old artifact is
  grandfathered.
- Encode Neon upgrade triggers as Capacity, Reliability, Operations, and Data
  Risk observations. The tool recommends review; it never purchases a plan.
- Require domain audit fields (trademark, canonical-domain availability, social
  handle, pronunciation/spelling) before recording a domain decision. It never
  purchases or binds a domain.
- Keep payment/subscription code absent and add a guard test for that boundary.

### WP5 — Privacy, operations, and handoff

- Update the privacy notice before any new fields reach Production.
- Reconcile runbook, checklist, current status, and handoff to the new artifact
  version and explicit remaining founder sign-offs.
- Create a migration on a disposable Neon branch, run migration/integration
  checks there, then require explicit Production migration authorization.
- Verify Preview end-to-end before Production promotion. Production rollout is
  allowed only when the exact commit, migration ledger, runtime readiness, and
  operational attestation all agree.

## Deliberate non-goals

- No real recommendation/ranking engine, photo reveal, staged-reveal UI,
  production AI depth model, vector search, payments, subscription, or rebrand.
- No claim that five cohort quotas override supply safety.
- No collection of sensitive raw gender/sexual-orientation data in this change.
- No automatic Neon purchase, domain purchase, or Stage 2 expansion.

## Verification protocol

Verification is accepted only after all four layers pass:

1. **Constructive proof:** lint, typecheck, unit tests, build, migration manifest,
   and focused integration tests.
2. **Destructive proof:** concurrent invite issuance, unauthorized/self/blocked
   messaging, deletion residuals, metric-denominator edge cases, stale evidence,
   and missing-data fail-closed tests.
3. **Independent environment proof:** disposable Neon branch plus Vercel Preview
   on the exact commit.
4. **Dialectical re-check:** attempt to prove the opposite claims — that the cap
   can be exceeded, that KPI PASS can be manufactured from immature data, that
   Free is automatically safe, or that a mock interaction counts as retention.

## Exit states

- `READY_FOR_FOUNDER_SIGN_OFF`: code and independent evidence pass; only explicit
  founder/external actions remain.
- `CONDITIONAL`: product evidence is promising but a required market/supply
  condition is unstable or unmeasured; do not increase invitations.
- `BLOCKED`: a safety, privacy, migration, observability, or evidence identity
  gate fails.
- `NO_GO_OR_REDESIGN`: the mature market evidence satisfies the v4.2 stop rule.
