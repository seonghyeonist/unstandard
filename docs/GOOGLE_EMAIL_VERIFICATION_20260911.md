# Google email verification — 2026-09-11

Scope: PR #80 Preview; reviewed parent `20102ae2775b9151ccb9b47f54ede1d681a823f4`.
This is source/test evidence, not successful live Google acceptance.

## Finding and correction

The lockfile pins Better Auth 1.6.23. Its installed
`@better-auth/core/dist/social-providers/google.mjs` maps the Google ID-token
`email_verified` claim into `user.emailVerified`, allowing the application's
`mapProfileToUser` override. UNSTANDARD already maps only boolean `true` to true.

However, `better-auth/dist/oauth2/link-account.mjs`, in the new-user branch of
`handleOAuthUserInfo`, calls `internalAdapter.createOAuthUser` with that boolean
without requiring it to be true. The later optional verification-email dispatch
is not a pre-creation rejection. The verified-email checks in the existing-account
linking branch do not provide a guarantee for new accounts.

Therefore the application user-create hook now passes `user.emailVerified` into
the invite policy, which requires exact boolean `true` alongside a valid reserved
invite and a nonempty normalized email match. No dependency, schema, existing-login
policy, provider credential, or account-linking configuration changes are needed.

## Regression evidence

`tests/oauth-invite-gate.test.ts` checks false, missing, null, string and numeric
claims, including an otherwise matching reserved invite. It also executes the
actual transpiled application user-create hook with mocked external dependencies:
verified matching Google succeeds; unverified Google, mismatched email, missing
ticket, invalid reservation and Naver new-user creation reject.

The hook test exercises real application enforcement with synthetic dependencies;
it is not a live Google token exchange or a database integration test.

## Other reviewed boundaries

- Direct `/sign-up/email` is rejected by the server plugin. Existing credential
  sign-in and the Naver provider integration remain enabled.
- Account linking remains disabled, including implicit and cross-email linking.
- Registration renders only Google. The invite fragment is removed before the
  same-origin POST exchange. No localStorage/sessionStorage capability persistence
  is present in this flow.
- Prepare validates without reservation; explicit legal-consent POST claims the
  invite. Registration GET reads tickets only. GET/prefetch does not reserve.
- Operator login uses the dedicated credential, timing-safe comparison,
  same-origin checks, rate limiting and an HttpOnly session. Invite issuance uses
  application capacity/balance rules; direct SQL insertion is not an alternative.

## Remaining acceptance evidence

The previously named deployment `dpl_Hua2rwuH6SU4CakKUo2qpttz2LSK` was READY,
but metadata and build logs did not establish source SHA equality. Protected
application fetch reached Vercel SSO (302), not an authenticated app session.

The historical verification branch `br-hidden-rice-aj5bed7o` in project
`raspy-fog-00907976` remains non-default/non-primary, `init_source=parent-data`.
Read-only counts: users/finalized users 5/5; verified emails 0; credential/Google/
Naver accounts 5/0/0; invites 12, pending/reserved/consumed 2/1/6; identity rows/
verified identity rows 0/0. Runtime DB binding is not established by those counts.

Live invited registration, sign-out, same-account re-login and corresponding DB
deltas remain required. Operator env presence and branch scope must be inspected
through authorized Vercel access before creating or changing any credential.
Didit and the other Closed Alpha release gates remain separate and unverified.

Rollback: revert the verification change on the PR branch and revalidate Preview;
this reopens the identified verification gap and does not authorize acceptance.
No Production or database rollback is needed for this source-only correction.

## Operator-access follow-up

The founder completed the Vercel device-authorization screen. The waiting CLI
process could not complete its token exchange because this agent runtime blocked
network access to `api.vercel.com:443`; neither standard CLI credential location
contained a token afterward. This records an execution-environment limitation,
not a failed founder authorization. The connected Vercel surface can inspect and
deploy but currently exposes no environment-variable read/write operation.
Operator-token presence therefore remains unknown until an env-capable surface is
available; do not generate, rotate or overwrite a token on that assumption.
