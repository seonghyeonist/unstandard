# UNSTANDARD Closed Alpha Stage 1 runbook

**Version:** founder-resolution-v0.1 / operations-v4
**Effective:** 2026-08-12
**Current verdict:** `STAGE1_NOT_READY`

## 1. Decision contract

Stage 1 is a maximum 50-person, maximum six-week market experiment. It tests
onboarding, question response, first blur unlock, first persisted message, D7
return, channel quality, waitlist revisit, and whether supply can be operated
safely. A passing build is not a market `GO`.

The decision order is fixed:

1. design and instrument Closed Alpha;
2. acquire one canonical domain after the four-part audit;
3. remain on Neon Free only while all four upgrade triggers are false;
4. test willingness-to-pay after retention; do not implement payment in Alpha.

Stage 2 (100–200 people) is prohibited until a Stage 1 decision artifact is
reviewed. The six weeks are a maximum observation window, not a promise to run
an unchanged experiment through obvious failure.

## 2. Source of truth and conflict rule

- KPI thresholds and Go/Conditional Go/No-Go: MVP Master Spec v4.2.
- 50-person / five-cohort design and no pre-alpha payment: AI Agent Harness &
  Online Marketing Playbook v0.1.
- acquisition metadata and staged-reveal deferral: Alpha/Beta Target & Staged
  Reveal Change Note v0.1.
- decision sequencing and spend triggers: Founder Decision Proposal v0.1.
- executable acceptance criteria:
  [`FOUNDER_DECISION_EXECUTION_PLAN_20260812.md`](./FOUNDER_DECISION_EXECUTION_PLAN_20260812.md).

Older 30-seat/v3 instructions are historical and cannot authorize this release.

## 3. Current external baseline (read-only, 2026-08-12)

| Surface | Observed state | Meaning |
|---|---|---|
| GitHub `main` | `da90853d28eaa77e71019f28f8f7e00cc3be7be4` | Baseline only; it does not contain this Stage 1 change. |
| Vercel Production | `dpl_HaswwnRTj85dUp4sRaLiZFrycJza`, READY, same SHA | Historical technical baseline only. |
| Neon project | `raspy-fog-00907976` | Exact project is pinned. |
| Neon Production branch | `br-bitter-wave-ajs8dy0u` (`main`) | Default/root, Ready, `protected=false`, Free. |
| Neon recovery history | 6 hours | Active Data Risk observation; not a backup guarantee. |
| Production data | 5 users, 5 profiles, 12 invite rows | Do not delete or mutate during drills. |
| Production ledger | migrations `0000`–`0004` (5 rows) | This release adds `0005` and `0006`; Production is intentionally behind until approval. |
| Canonical domain | Vercel-provided domains only | Founder domain acquisition gate is open. |
| Extra Neon child | `br-holy-sunset-ajo5h07n` | Do not delete until its ownership/data purpose is verified. |

No baseline observation is permission to migrate, deploy, purchase, delete, or
expand invitations.

## 4. Admission and recruitment

### 4.1 Atomic 50-seat rule

PostgreSQL trigger `alpha_stage1_capacity_guard` serializes relevant writes with
a transaction-scoped advisory lock. It counts:

- every consumed Stage 1 invite; and
- unexpired pending or reserved Stage 1 invites.

Revoked and expired invites do not occupy a seat. Seat 51 fails with SQLSTATE
`23514`. Pre-migration rows are classified `legacy_pre_stage1`; they remain
usable as historical technical accounts but cannot be reserved/consumed as new
Stage 1 invitations and are excluded from cap/KPI population. The operator
command performs the same locked observation for a useful
error, but the database trigger remains final authority even for another writer.

Create an invite only with declared metadata:

```bash
npm run alpha:invite:create -- \
  --email person@example.com \
  --cohort founder_network \
  --channel founder_direct \
  --balance-bucket bucket_a \
  --balance-consent-version stage1-role-preference-v1 \
  --balance-consented-on 2026-08-17
```

Valid recruitment cohorts:

- `founder_network`
- `writing_reading`
- `subculture_meme`
- `dating_app_fatigue`
- `quiet_introvert`

The target is ten per cohort, but it never overrides supply safety. Existing
pre-migration invites become `legacy_pre_stage1` with `legacy_unassigned` /
`legacy_unknown`; reissue any real Stage 1 invitation through the operator CLI
instead of fabricating its provenance.

### 4.2 Supply balance

The founder-approved comparable market is consenting adults in the Seoul metro
area seeking one-to-one romantic conversation. The role question is separate
from signup and optional: A means “I prefer to initiate the first conversation”;
B means “I prefer to receive a first conversation before responding.” Both,
neither, skipped, withdrawn, inferred, or ambiguous answers are `not_counted`.
Do not infer gender, sexuality, or identity and do not use these roles outside
this one market.

For `bucket_a` or `bucket_b`, the operator must first show the role question and
record affirmative use of that answer for Stage-1 supply balancing. The CLI
requires consent contract `stage1-role-preference-v1` and the UTC consent date;
PostgreSQL rejects a counted bucket without both. `not_counted` rejects consent
metadata so absence cannot masquerade as consent. Store no answer prose or
precise consent time. A participant may withdraw by pausing/revoking an
unconsumed invite and reissuing it as `not_counted`; after consumption, pause
recruitment and handle correction through the privacy owner before using later
metrics.

For the declared A/B market, v4.2 thresholds are:

| Majority share | Gate | Operator action |
|---:|---|---|
| ≤60% | `OPEN` | Normal batched invitations. |
| >60% and <65% | `BOOST_MINORITY` | Increase minority acquisition/exposure and review any majority addition; the CLI warns but does not hard-stop this band. |
| ≥65% and <70% | `SOFT_WAITLIST` | Stop majority-bucket invitations; waitlist them. |
| ≥70% | `HARD_GATE` | Stop majority-bucket admission immediately. |

The invite command refuses majority additions at soft/hard thresholds. Direct
SQL is not an accepted operating path.

## 5. Measurement contract

Run the read-only aggregate snapshot:

```bash
npm run alpha:metrics > /secure/operator/alpha-metrics-YYYYMMDD.json
```

The artifact contains no email, answer, message body, user ID, or profile ID.
It includes a SHA-256 content digest, but the digest is integrity metadata, not
a cryptographic signature or proof of Production origin.

| Metric | Exact implementation | Threshold / maturity |
|---|---|---|
| Onboarding | onboarded participants / finalized Stage 1 participants | ≥75%; minimum 10 |
| First blur | median seconds from account creation to first persisted unlock | ≤180 seconds; minimum 10 unlockers |
| Question response | unique viewer/profile exposures with an unlock attempt / unique exposures | ≥55%; minimum 10 exposures |
| First message | mean Unicode length of each sender's first persisted message | ≥25 characters; minimum 10 senders |
| Overall D7 | activity on exact UTC day registration+7 / mature participants | ≥40%; minimum 10 |
| Channel D7 | same D7 by acquisition channel | ≥45%; minimum 5 per channel |
| Waitlist revisit | entry with a visit on a later UTC date / entries | ≥25%; minimum 10 |
| Supply maintenance | days at ≤60:40 / observed days | ≥80%; minimum 7 days and ≥80% counted-bucket coverage |

Small samples are `INSUFFICIENT_DATA`, never zero and never PASS. Activity
storage is one content-free row per user per UTC day. Profile exposure stores
only one viewer/target relation, without repeat counts or timestamps. Waitlist revisit stores only unique
dates after affirmative email-processing consent. Account deletion cascades
messages, activity, and exposure; waitlist membership has a same-browser
capability deletion control.

Fast-track mean depth remains `NOT_IMPLEMENTED` and is not silently substituted
with the deterministic local heuristic.

## 6. Founder decision rule

`GO` requires all of:

- at least three of the four product lower-bound metrics PASS;
- at least one mature acquisition channel D7 ≥45%; and
- mature waitlist revisit ≥25%.

`CONDITIONAL_GO` means product behaviour is promising but channel, supply, or
waitlist evidence remains unstable. Do not expand invitations; change wedge or
acquisition and observe again.

`NO_GO_OR_REDESIGN` fires when two or more mature stop signals among onboarding,
question response, and supply balance fail, or when all five cohorts have mature
D7 evidence and none is a quality cohort. Registration totals cannot override
the result.

`COLLECTING` means a minimum observation window/sample has not been reached. It
is not a weak Go.

## 7. Six-week operating calendar

| Week | Primary decision | Required review |
|---:|---|---|
| 1 | Copy, onboarding, waitlist | completion, support, privacy consent, hard errors |
| 2 | First success/question response | exposure→attempt, first blur time, rejects |
| 3 | Cohort/channel quality | cohort and channel D7 maturity, no vanity override |
| 4 | Fast-track/progressive-depth design only | no Production AI/staged reveal enablement |
| 5 | Supply/waitlist operation | daily balance gate and counted coverage |
| 6 | Founder decision | Go / Conditional Go / No-Go with reasons |

Review daily while invitations are active: new seats, onboarding, exposure and
attempt counts, messages, D7 maturity, open reports/support, rate-limit 429/503,
Vercel 5xx/runtime errors, Neon consumption/recovery state, and balance gate.
Pause immediately on a P0 privacy/safety failure, missing deletion path,
unavailable moderation owner, capacity trigger, recovery degradation, or
unexplained evidence mismatch.

## 8. Minimal messaging safety contract

Database-runtime messages require:

- authenticated and onboarded sender and real onboarded target;
- at least one unlock direction between the two profiles;
- no block in either direction;
- 1–500 trimmed characters;
- shared Neon rate limit: 20 sends per 10 minutes per pseudonymized user.

Messages are private/no-store over HTTP and cascade when either participant
deletes their account. Reports that target a deleted message are removed by the
user-deletion trigger. This is minimal Alpha messaging, not a claim of a full
matching/recommendation system.

## 9. Waitlist and privacy operations

Waitlist joining is limited to five requests per IP per 24 hours; limiter state
uses an HMAC-pseudonymized subject. Duplicate email submission returns the same
generic acceptance and does not issue a new deletion capability. The raw
capability is HttpOnly and only its hash is stored.

The public `/privacy` notice must be live on the exact release before collection
starts. Test same-browser waitlist deletion, authenticated account deletion,
message/report residual deletion, and privacy support triage. A lost waitlist
capability requires a manual verified-email deletion procedure; document its
opaque drill reference in the attestation without committing an email address.

## 10. Neon Free / upgrade decision

Free is the default only while every trigger is false:

| Trigger | Set true when | Required action |
|---|---|---|
| Capacity | storage/compute/branch allowance approaches the current plan limit or throttles work | Pause invitations; review a paid plan. |
| Reliability | cold starts, latency, disconnects, or DB-caused 5xx harm real users | Pause; diagnose and review paid capacity. |
| Operations | required protection, restore, backup, or access-control workflow cannot be achieved safely on Free | Upgrade or remain blocked. |
| Data Risk | user-data value/exposure exceeds the accepted six-hour-history/unprotected-branch risk | Upgrade/protect before proceeding. |

Prices, quotas, and plan feature names are re-read from current official Neon
sources when a trigger fires; no price is frozen into this runbook. The app
never purchases a plan. Attestation v4 records a fresh boolean observation for
all four triggers. Any true trigger invalidates the Free exception.

The time-bounded v2 exception additionally requires exact project/branch IDs,
`maximumCohortSize=50`, expiry within 30 days, current disposable migration and
restore proof, no Production reset/delete/`DROP TABLE`/`TRUNCATE`, manual
approval for every Production change, and an invitation pause on degradation.

## 11. Domain gate

Before Alpha launch, acquire exactly one canonical domain and record:

- no blocking trademark conflict found (not legal certainty);
- availability/acquisition evidence;
- relevant social-handle evidence; and
- pronunciation/spelling confusion review PASS.

Attestation v4 rejects placeholders, `*.vercel.app`, or a merely available but
unacquired domain. Domain purchase and DNS binding require founder choice; do
not infer authorization from this runbook. Large-scale rebranding remains
prohibited before behaviour data.

## 12. Monetization gate

Closed Alpha is free. Payment/subscription dependencies and endpoints are
guarded absent. Beta may first use a clearly labelled interest/fake-door test;
its click is a weak signal, not proof of payment. Real payment requires mature
retention, a separate willingness-to-pay decision, updated privacy/terms, and a
new implementation authorization.

## 13. Release and database procedure

1. Freeze the implementation commit; run `npm run check`, boundary/legacy
   guards, and dependency audits.
2. Create a fresh disposable child of Neon Production. Never use the leftover
   child by name without verifying its ownership and contents.
3. Set `DATABASE_ENV=test`, explicit destructive-test confirmation, and both
   `TEST_DATABASE_URL` and repository `DATABASE_URL` to that disposable branch.
4. Run migrations `0005` through `0007` through the canonical migrator; run the
   real integration proof. Re-run migrations and prove ledger/schema no-op.
5. Test legacy-invite exclusion, seat-51 concurrency, message
   authorization/blocking/deletion, waitlist revisit/deletion, KPI immaturity,
   and account deletion. Capture only opaque references.
6. Publish the exact commit to GitHub and require CI success.
7. Deploy Vercel Preview from that exact commit with a Preview database branch;
   run HTTP/browser verification, privacy/waitlist, auth/onboarding/unlock,
   message, report, deletion, and runtime-error scans.
8. Obtain explicit Production migration approval. Baseline users/profiles,
   invite states, ledger, table count, trigger/function identity, and database
   fingerprint without selecting content.
9. Apply only the reviewed migrations to `br-bitter-wave-ajs8dy0u`; do not seed.
   Prove user/profile counts unchanged and ledger now has eight exact hashes.
10. Merge/promote only the verified commit. Confirm Vercel Production READY and
    exact SHA; run `operations:production:verify`.
11. Complete operator-local v4 attestation including acquired domain, current
    upgrade triggers, supply procedure, support/deletion/restore references,
    and `monetizationMode=disabled`; run `operations:closed-alpha:gate`.
12. Only after both artifacts PASS, issue small batches through the operator
    command. Never bulk-fill 50.

Build and Vercel deploy must never run migrations automatically.

## 14. Rollback and recovery

- Stop invitations first; record timestamp, exact SHA/deployment, affected
  paths, and last known-good metrics artifact.
- Application rollback may use only a previously verified READY deployment.
  Re-run exact-SHA Production readiness after rollback.
- For data loss, inspect an isolated historical branch first. Prefer row-level
  recovery. Full branch restore overwrites schema/data and requires separate
  human approval.
- A rollback to code that expects only migrations `0000`–`0004` is not assumed
  schema-safe after `0005`/`0006`; use forward-compatible rollback review.
- Do not delete test/recovery branches until evidence is retained and ownership
  is confirmed; then delete only the exact approved branch ID.

## 15. Launch blockers at this checkpoint

- implementation branch not yet independently reviewed or merged;
- migrations `0005`/`0006` passed diagnostic disposable-Neon verification,
  but a fresh exact-SHA machine artifact is still required;
- no exact-head Vercel Preview/Production evidence;
- canonical domain not selected/acquired/audited;
- role-based A/B market and separate consent are founder-approved and enforced;
- v4 Free exception/upgrade-trigger observation not signed;
- Production migration not authorized or applied;
- new support, deletion, restore, and runtime evidence not captured.

Until these close, the correct state is `STAGE1_NOT_READY`; do not reuse the
historical 30-seat launch artifact.
