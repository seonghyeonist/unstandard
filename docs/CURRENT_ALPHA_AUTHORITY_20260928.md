# Current Closed Alpha Authority — 2026-09-28

> Historical snapshot only. Superseded for current Didit retention and release-gate decisions by [CURRENT_DIDIT_OPERATIONAL_AUTHORITY_20261001.md](./CURRENT_DIDIT_OPERATIONAL_AUTHORITY_20261001.md). The two-year Sandbox retention value below was the earlier observation and is not current.

This index records a dated 2026-09-28 snapshot for provenance. It is retained as historical evidence and is no longer the current operational authority for Didit; use the superseding record linked above.

## Authentication and release path

- Google and Naver OAuth are retired for Closed Alpha signup, login, callbacks,
  and account linking. Google was used successfully to sign into the Didit
  provider console; that does not restore Google OAuth in UNSTANDARD.
- New accounts use a personal invite, server validation, email ownership proof,
  required versioned legal acceptance, Better Auth email/password credentials,
  then profile setup. Existing users sign in with email/password; recovery uses
  email password reset.
- The current authentication decision is
  [CLOSED_ALPHA_AUTH_PATH_DECISION_20260910.md](./CLOSED_ALPHA_AUTH_PATH_DECISION_20260910.md).
- PR #80 is the application/release path. PR #91 contributes dependency and
  security-override changes only; combine those semantically and preserve PR
  #80-specific scripts. PR #89 Local AI research remains Draft, unmerged,
  default-off, and outside the required alpha path.
- The release candidate must not merge to `main`, deploy to Production, or
  write to the default/production Neon branch in this verification task.

## Product and evidence decisions

- `HUMAN_LABEL_REVIEW = WAIVED_BY_FOUNDER / NOT_PERFORMED`. Do not require
  reviewer completion for Closed Alpha or describe the waiver as accuracy,
  calibration, agreement, or ground truth.
- `mock-local-heuristic-v0.0` remains the authoritative depth scorer. Local AI
  shadow remains off and non-authoritative.
- Closed Alpha recruitment may include university students, but the product is
  not university-only. Age 25–39 is a beta direction, not an alpha eligibility
  gate.
- Preserve question → answer → blur/unlock → conversation. Do not add staged
  reveal, photo-first matching, or a new recommendation engine for this alpha.
- Didit notice gate remains `IDENTITY_PROVIDER_NOTICE_READY=false` until the
  provider/account facts and applicable terms are evidenced and the notice
  matches them. A console login or founder approval alone is not provider
  evidence.
- **The DocuSeal signing is complete; do not ask the founder to sign again.**
  The 2026-09-23 completion email and audit log identify envelope `11470835`,
  LEE SEONGHYEON (CEO, `unstandard`), and completed submission. Visual review
  of the original **Business Terms & DPA v2 — Didit Identity Spain** PDF page 8
  also shows signature marks for both parties: Didit Identity Spain, S.L.,
  Alberto Rosas García (CEO), and `unstandard`, LEE SEONGHYEON (CEO), dated
  2026-09-23. This records document evidence, not a legal opinion about which
  entity or account it binds.
- Didit support ticket #59707 remains open. Its latest general response says
  the account flow offers Spain or US contracting entities, provider data is
  processed on AWS Ireland, subprocessors are AWS EMEA and Google Maps Platform
  (PoA geocoding only), retention defaults to unlimited and is configurable,
  and organization model-improvement opt-out affects future processing only.
  It does not establish this account/app's legal-entity assignment, recognized
  `unstandard` customer identity (console Legal Name and Tax ID are blank),
  account-specific support access/region, signed-term applicability, or the
  opt-out change's effective timestamp. The current Live app shows unlimited
  retention; the separate Sandbox app shows two years. Both show biometric
  template deletion with the session. Organization model-improvement is
  currently opted out. Keep the notice gate false; complete these facts and
  Sandbox technical proof before proposing any activation.

## Historical and superseded material

These files remain for provenance. Their old operational instructions are not
the current Closed Alpha implementation path:

- OAuth configuration and callback guides:
  [OAUTH_CLOSED_ALPHA_AUTH_20260903.md](./OAUTH_CLOSED_ALPHA_AUTH_20260903.md),
  [OAUTH_EXTERNAL_SETUP_GUIDE_20260904.md](./OAUTH_EXTERNAL_SETUP_GUIDE_20260904.md),
  [HANDOFF_20260903_OAUTH_DIDIT_EXTERNAL_SETUP.md](./HANDOFF_20260903_OAUTH_DIDIT_EXTERNAL_SETUP.md),
  and [HANDOFF_20260904_DIDIT_KEY_OAUTH_NEXT.md](./HANDOFF_20260904_DIDIT_KEY_OAUTH_NEXT.md).
- The previous backend cutover record remains historical audit material, not a
  current setup guide; its own header points to this authority index.
- [LOCAL_AI_LABEL_DATASET_GATE.md](./LOCAL_AI_LABEL_DATASET_GATE.md) documents
  a future offline Local AI calibration gate only. Its human-label blocker is
  not an alpha blocker; the founder waiver above is current.
- For the current provider gate, use the dated Didit evidence documents and
  open support ticket #59707 together with the signed PDF and console
  observations summarized above. Keep unknown provider/account facts
  explicitly unresolved. The former checklist
  [DIDIT_LEGAL_GATE_GUIDELINE_20260916.md](./DIDIT_LEGAL_GATE_GUIDELINE_20260916.md)
  contains a dated earlier snapshot; its old statement that signing was
  missing is superseded by this section.

## Verification baseline snapshot

At the start of this verification pass, `main` was
`30d0c78ee19d652fed2bedcae7271931f8f04b31`; PR #80 was open/draft at
`6459c3503cfd20e8baaee97cd62d7f200c7ad2d4`; PR #91 was open/ready at
`5a6db2e8a6dbba9dd9af67b54d493fe8ec51c281`; and PR #89 was open/draft at
`bd4d957dd74e238525494edf0c494a92905f1f01`. These are a dated snapshot, not a
substitute for re-reading live GitHub state before release actions.

Disposable Neon verification must use a newly created, empty database. The
previous PR #87 compatibility databases and any partially migrated database
are `DO_NOT_REUSE`; preserve them as historical evidence.
