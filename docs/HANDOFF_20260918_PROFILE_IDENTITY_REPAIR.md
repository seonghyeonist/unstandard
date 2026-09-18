# Profile + identity integration handoff — current snapshot (2026-09-18)

> **CURRENT HANDOFF.** Revalidated against GitHub, Vercel and the isolated Neon verification branch on 2026-09-18.
> This is an operational evidence snapshot, not a Production or Closed Alpha launch approval.

## Executive verdict

```text
PROFILE_SAVE=PASS
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=NOT_RUN
PREVIEW=PASS
NEON=PASS_READ_ONLY
CI=PASS
CLOSED_ALPHA_READY=NO
```

## Exact provenance

```text
Repository/PR: seonghyeonist/unstandard / #80
Branch: feat/alpha-profile-identity-20260828
GitHub HEAD: 58933b3beade55dd89a2ac2a21fff653f3bb3d5d
Vercel project: unstandard-m9qj (prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn)
Vercel deployment: dpl_J1eHD9j18Boxkc2sREEzjQdwmfQB
Vercel URL: https://unstandard-m9qj-7o67tnuis-unstandard.vercel.app
Vercel Git SHA/source/state: 58933b3beade55dd89a2ac2a21fff653f3bb3d5d / git / READY
Preview branch alias: unstandard-m9qj-git-feat-alpha-profile-identi-5d46bc-unstandard.vercel.app
Neon project: unstandard-alpha-preview-app-db (raspy-fog-00907976)
Neon branch: pr80-verification-clean-20260904 (br-hidden-rice-aj5bed7o)
```

The PR remains OPEN/DRAFT and was not merged. `main`, Production Vercel settings/environment, the default Neon branch, and migration history were not changed.

## Current root causes and repairs

### Profile save

The server PUT path and database write were already healthy. The old `updatedAt` remount reset the required legal-consent checkbox after a successful refetch and gave no explicit success state.

The remount was removed. The form now distinguishes saving, unsaved, saved and error states with an `aria-live` message. Consent remains required and is deliberately re-affirmed for the next mutation; server-side consent validation was not weakened.

### Didit

Didit remains closed by the reviewed release policy, not by an inferred API outage:

- `IDENTITY_PROVIDER_NOTICE_READY=false`;
- server-only readiness distinguishes `NOTICE_NOT_READY`, `ENV_DISABLED`, `CONFIG_INCOMPLETE`, `INVALID_APP_ORIGIN`, `WEBHOOK_NOT_CONFIGURED` and `READY`;
- the browser receives only availability plus a coarse public reason;
- diagnostics are allow-listed and PII-free;
- canonical decision lookup and purge-before-local-`verified` ordering remain enforced;
- OAuth retirement remains unchanged.

The legal-gate checklist is in `docs/DIDIT_LEGAL_GATE_GUIDELINE_20260916.md`. Its L1–L10 evidence packet is not approved, so the gate must remain fail-closed. No legal entity, DPA, region, retention policy, privacy approval, webhook secret, or test identity was invented or treated as approved.

## Verification evidence

### GitHub

Current HEAD workflow runs:

- CI #201, run `35049518565`: SUCCESS
- Rebuild CI #141, run `35049518706`: SUCCESS

The current HEAD is documentation-only after the reviewed runtime implementation; the implementation tests remain covered by the successful CI/rebuild runs.

### Vercel

The current exact-head deployment is Git-linked, READY, and carries the same SHA as GitHub HEAD. A grouped runtime-log query for this deployment over the last seven days returned no status-code entries. Existing runtime-error groups are historical entries from older deployments and are not claimed as current-head E2E evidence.

### Neon

Reads were performed only on the non-default, non-primary verification branch `br-hidden-rice-aj5bed7o`. Count-only snapshot:

| Table | Rows |
| --- | ---: |
| users | 5 |
| accounts | 5 |
| profile_basics | 1 |
| identity_verifications | 0 |
| legal_acceptances | 0 |
| alpha_invites | 17 |
| alpha_email_verifications | 0 |

The branch reported zero written data in the current branch inspection. No Didit identity row was created by this revalidation.

## Remaining blockers

1. L1–L10 Didit/legal release evidence remains unapproved: controller/processor contract, account-specific region and transfer facts, approved data map, retention/deletion approval, final Korean notice/version, published workflow scope, webhook security/delivery evidence, Preview-only environment binding, reachability/protection design, and approved sandbox test identity/consent.
2. Didit hosted E2E remains NOT RUN. The Google OAuth login attempt used only the Didit Business Console sign-in page and was not an application OAuth change; the cloud browser's Google endpoint returned a 502 connection error. No credentials or OTP were collected.
3. The current Vercel project has a protected Preview surface; any future external callback/webhook reachability exception needs a reviewed, narrowly scoped non-Production design.

Until those blockers are independently approved, keep:

```text
IDENTITY_PROVIDER_NOTICE_READY=false
DIDIT_CONFIG=BLOCKED_LEGAL_NOTICE
DIDIT_E2E=NOT_RUN
CLOSED_ALPHA_READY=NO
```

## Historical-document handling

`docs/HANDOFF_20260914_PROFILE_IDENTITY_REPAIR.md` is retained as a historical record and explicitly points to this current snapshot. It must not be used as the current exact-provenance source.
