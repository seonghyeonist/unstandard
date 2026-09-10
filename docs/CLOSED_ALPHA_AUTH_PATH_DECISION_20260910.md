# Closed Alpha authentication-path decision — 2026-09-10

## Scope and non-goals

This decision applies to new member registration on PR #80's Preview branch.
It does not delete OAuth credentials or provider-account rows, alter Production,
or mark identity verification as successful.

## Evidence at decision time

- Branch `feat/alpha-profile-identity-20260828` was at
  `13af25bcf53d73769313d82d4e57495701a9a54b`; PR #80 was open and draft.
- The matching Preview deployment was `READY`; its `/login` page rendered
  database authentication and both provider buttons. This verifies only that
  the provider configuration is available to that deployment, not successful
  member registration.
- Live evidence exists for Google authorization reaching the application
  callback and safely returning `account_not_linked` for an unlinked account.
  There is no successful invited Google registration, successful Google
  re-login, or successful Naver member flow recorded for the current head.
- The isolated Preview verification branch contained credential accounts but no
  Google or Naver provider-account rows. All counted users had
  `email_verified = false`; this count is not a claim about data provenance.

## Decision

New members may register only through the Google account whose email matches a
valid, reserved invite. Existing members can continue to use the existing
email/password sign-in route and already-linked Naver sign-in route.

The server rejects direct email/password signup and Naver new-user creation,
so the registration page is not the only enforcement point. Naver credentials
and existing provider-account data are retained. This is a conditional Preview
decision, not Closed Alpha launch approval.

## Why the alternatives were not selected

| Option | Decision | Reason |
| --- | --- | --- |
| A. Email/password new signup | Not selected | Email ownership verification and a password-reset delivery callback are not configured. The invite is delivery control, not a complete email-ownership proof. |
| B. One OAuth provider | Selected conditionally | Google has the strongest available live evidence and is already implemented. Successful invited signup and re-login still require a controlled member test. |
| C. New email OTP/magic link | Not selected | It requires an outbound email provider, sender/domain configuration, token lifecycle, abuse control, recovery design, and new acceptance tests; no concrete advantage over the existing Google path was established. |

## Required Preview acceptance evidence

1. A fresh, non-production invite is issued for a test email without exposing
   its raw capability in logs, source, or chat.
2. In the founder's browser, the matching Google account opens the invite,
   accepts the legal confirmations, and completes registration.
3. The member signs out, then signs back in with the same Google account.
4. A different Google account and an uninvited browser both fail closed.
5. Server-side count-only evidence confirms exactly one finalized user and one
   Google provider-account binding for the test invite, with no identity status
   forced to verified.

The human's success report is `USER_REPORTED` until it is compared with the
non-sensitive server-side evidence in step 5, at which point it is `VERIFIED`.
Do not request cookies, authorization codes, identity documents, images, or
raw invite capabilities from the tester.

## Separate blockers

- An operator credential must be present in Preview before an agent can issue
  a fresh invite through the intended operator boundary. Its value must never
  be retrieved or printed.
- Didit account/workflow/webhook, Korean document coverage for the configured
  workflow, privacy facts, and Sandbox validation remain independent release
  gates.
- Production remains outside this change.
