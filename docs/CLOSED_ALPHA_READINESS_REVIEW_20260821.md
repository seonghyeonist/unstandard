# Closed Alpha Stage 1 readiness review — 2026-08-21

**Decision:** `CONDITIONAL / STAGE1_NOT_READY`

This is a current-state review, not a legal opinion and not a Production launch
attestation. Evidence is labelled `OBSERVED`, `PROVEN`, `BLOCKED`, or
`NOT_CHECKED`. Historical evidence tied to another Git SHA is not reused as
current proof.

## Subject and current deployment

| Item | Current observation | Status |
|---|---|---|
| GitHub `main` | `a59556f4cc749ade21dee511109e7f9cf12cee63` | `OBSERVED` |
| Current implementation branch | `codex/closed-alpha-legal-safety-20260821` | `OBSERVED` |
| Vercel Production | `dpl_BLnfemiNBTxhkEfPZTzVz65KReY8`, `READY`, exact SHA above | `OBSERVED` |
| Canonical aliases | `unstandard.app`, `www.unstandard.app` are attached to that deployment | `OBSERVED` |
| Production runtime errors | No grouped runtime errors observed in the last 1 hour | `OBSERVED`, not uptime proof |
| Neon Production | project `raspy-fog-00907976`, branch `br-bitter-wave-ajs8dy0u`, Free-like, unprotected | `OBSERVED` |
| Neon recovery history | 6 hours | `OBSERVED` |
| Current Production schema | `legal_acceptances` is not yet present | `OBSERVED` |
| Current Production public notices | `/privacy` is the older `2026-08-17` page; `/terms` and `/safety` return 404 | `OBSERVED` |

The new legal gate and notice changes are therefore not live in Production.
No Production migration, reset, seed, or data mutation was performed in this
review.

## Implemented on the dedicated branch

- Added public `/terms` and `/safety` pages with versioned Closed Alpha text.
- Reworked `/privacy` to disclose overseas processing fields, retention and
  recovery window, logged-out privacy contact, sensitive free-text warning, and
  the current non-generative Depth Score scope.
- Added a fail-closed, server-timestamped adult/terms/safety registration gate.
- Added `legal_acceptances` schema, migration `0008_strange_joshua_kane.sql`,
  migration manifest entry, and transactional invite-finalization persistence.
- Kept privacy notice separate from affirmative terms/safety acceptance.
- Added tests for the legal acceptance contract and updated invite coverage.

## Verification

- `npm run check`: `PASS` — lint, typecheck, 260 tests, and production build.
- `npm audit --omit=dev --audit-level=moderate`: `PASS` — 0 production
  vulnerabilities reported.
- `npm audit --audit-level=high`: `PASS` — 0 reported tooling vulnerabilities.
- Refined repository history scan: no private key, GitHub token, AWS key, or
  Vercel bypass assignment found. Credential-shaped strings were limited to
  documented local/test fixtures. A dedicated gitleaks/trufflehog binary was
  not available in the runner; this is not a substitute for GitHub secret
  scanning.
- `operations:production:verify`: `BLOCKED_EXTERNAL` — the operator token,
  approved DB host fingerprint, and write-once evidence path were not supplied
  to this workspace.
- `operations:closed-alpha:gate`: `BLOCKED_EXTERNAL` — no operator-local
  production evidence or completed attestation was supplied.

## P0 findings

| Finding | Status | Required closure |
|---|---|---|
| `main` branch protection | `BLOCKED_EXTERNAL` | Founder applies PR-only protection, required CI, no force-push/delete, and an explicit emergency bypass path. |
| New legal migration | `NOT_CHECKED` | Apply `0008` only through the approved non-Production rehearsal, then separately approve and apply to Production. |
| Exact-SHA Production evidence | `BLOCKED_EXTERNAL` | Run the operator-token-bound verifier against the deployment that contains the approved branch. |
| Privacy contact | `BLOCKED_EXTERNAL` | Activate and externally test `privacy@unstandard.app`; do not publish the new page before the route works. |
| Support/report/delete/restore/moderation drills | `NOT_CHECKED` | Fresh synthetic opaque references and cleanup results are required in the operator-local attestation. |
| Neon Free exception | `NOT_CHECKED` | Re-evaluate capacity, reliability, operations, and data-risk triggers at attestation time; pause or upgrade if any is true. |
| Domain acquisition evidence | `BLOCKED_EXTERNAL` | Retain registrar/receipt evidence. Vercel aliasing and unavailable-domain status do not prove ownership. |
| Trademark/handle clearance | `POTENTIAL_CONFLICT_REQUIRES_COUNSEL` | Use the companion domain audit and obtain a class-scoped counsel disposition before setting the v4 field to PASS. |
| Legal entity/telecom applicability | `BLOCKED_COUNSEL` | Confirm business entity, capital, service model, and any value-added telecom reporting/exemption with Korean counsel. |

## Read-only external observations

- KIPRIS trademark-name searches on 2026-08-21 returned domestic `0` for
  `UNSTANDARD` and domestic `0` for `언스탠다드`. A wildcard `UNSTAND*` search
  showed domestic `0` and overseas results, which were not treated as a
  complete conflict review.
- Vercel's connected domain checker returned `unstandard.app` as unavailable
  for purchase. This confirms only that it is not available to purchase through
  that checker; it does not prove registrar ownership or acquisition history.
- Public search surfaced unrelated existing uses such as Unstandard clothing
  and a music release. These are naming-clutter observations, not legal conflict
  findings.

## Devil's-advocate decision

`DO_NOT_SHIP` for public recruitment or a 50-person invite. A first batch of
6–10 may be considered only after the P0 rows above are closed, the approved
commit is deployed, both machine/operator gates pass, and the founder records
an explicit `SHIP_SMALL_BATCH` decision.

