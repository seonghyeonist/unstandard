# Profile + identity integration repair handoff — 2026-09-14

> **CURRENT HANDOFF.** This document records the code repair and the live
> Preview evidence available before this documentation-only follow-up commit.
> Re-read PR #80's current head before any later smoke test.

## Executive verdict

```text
PROFILE_SAVE=PASS (server/DB path preserved; success UX repaired)
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE (fail-closed by reviewed notice policy)
DIDIT_E2E=NOT_RUN (no approved external sandbox binding/test identity)
PREVIEW=PASS (Git-linked exact-head deployment READY)
NEON=PASS_READ_ONLY (isolated verification branch only)
CI=PASS (CI + Rebuild CI)
CLOSED_ALPHA_READY=NO
```

This is not a Production or Closed Alpha launch approval. `main`, Production
Vercel settings, Production environment variables and the default/Production
Neon branch were not changed.

## Exact provenance

The implementation commit for this handoff is:

```text
GitHub repository: seonghyeonist/unstandard
PR: #80 (OPEN / DRAFT)
Branch: feat/alpha-profile-identity-20260828
Implementation commit: 6622eb5e64e2f97dd2458712eebc9861fa1c399c
Vercel project: unstandard-m9qj
Vercel deployment: dpl_6sEsz9HB5Y5H8FRUfo9iyXWxSkkS
Vercel Git SHA: 6622eb5e64e2f97dd2458712eebc9861fa1c399c
Vercel source/state: git / READY
Preview branch alias: unstandard-m9qj-git-feat-alpha-profile-identi-5d46bc-unstandard.vercel.app
Neon project: unstandard-alpha-preview-app-db (raspy-fog-00907976)
Neon branch: pr80-verification-clean-20260904 (br-hidden-rice-aj5bed7o)
```

The Neon branch is non-default and non-primary. It was used only for
count/schema reads; no provider or identity data was created during this pass.

## Root causes and repairs

### Profile save looked like a failed save

The PUT path and database write were already healthy. `ProfileSetup` keyed the
form by `updatedAt`, so a successful refetch remounted the form and reset the
required legal-consent checkbox to `false`. There was no visible saved state.

The form no longer remounts on `updatedAt`. It now exposes saving, unsaved,
saved and error feedback through an `aria-live` status. Legal consent is still
re-affirmed for each mutation and the server-side consent validation is
unchanged.

### Identity was closed by a release gate, not a Didit API failure

`IDENTITY_PROVIDER_NOTICE_READY` remains `false` because the current privacy
notice does not yet state the confirmed Didit processor, transfer, retention,
deletion and contract facts required for real collection. Credentials alone
must not open KYC collection.

The provider factory now classifies server-only readiness as:

```text
NOTICE_NOT_READY | ENV_DISABLED | CONFIG_INCOMPLETE | INVALID_APP_ORIGIN |
WEBHOOK_NOT_CONFIGURED | READY
```

Only `available` and a coarse public reason (`not_ready` or
`temporarily_unavailable`) can reach the browser. Provider errors emit only
allow-listed stage/result codes and optional HTTP status; raw responses,
authorization values and identity data are not logged.

## Code and test changes

- Profile setup: removed the `updatedAt` remount and added explicit save-state
  feedback.
- Identity readiness: added server-only reason classification and safe public
  availability messaging.
- Didit adapter/service: added PII-free diagnostics for session creation,
  canonical decision, purge and local state transitions while preserving
  canonical decision re-fetch and purge-before-verified behavior.
- Webhook/HTTP routes: added safe diagnostics for unavailable readiness,
  malformed requests, signature failures and async completion failures.
- Tests: updated the gate contract and added regression coverage for the
  profile remount/save feedback and provider diagnostic redaction.
- OAuth retirement remains unchanged: no OAuth UI/config/callback or implicit
  account linking was reintroduced.

## Verification

```text
npm run check                 PASS (lint, typecheck, 353 tests, Next build)
npm run audit:security        PASS (0 vulnerabilities)
npm run guard:no-legacy-backend PASS
npm run guard:boundaries      PASS
GitHub CI                     PASS
GitHub Rebuild CI             PASS
```

The exact-head Preview was READY and had no runtime entries during the
immediate post-deploy read. No `/api/identity/start` request was claimed as an
E2E success because the readiness gate is intentionally closed.

## Remaining blockers

1. Confirmed Didit processor/legal facts and approved privacy wording are still
   required before a reviewed release can change the notice gate.
2. Didit Business Console sandbox application/workflow, Korean document
   coverage, webhook destination/secret and Preview-only environment binding
   were not connector-verified in this pass.
3. Therefore the hosted Didit start → decision → purge → local `verified` E2E
   remains **NOT RUN**, and `CLOSED_ALPHA_READY=NO`.

The independent technical work is complete and the remaining item is the
specific external/legal release gate above, not Vercel delivery, profile
persistence, Neon storage, CI or the OAuth retirement boundary.
