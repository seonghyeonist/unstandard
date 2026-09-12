# Closed Alpha authentication-path decision — direct invite signup

## Scope and non-goals

This decision applies to PR #80's Preview branch. It replaces Google/Naver as
the Closed Alpha new-member path with a direct credential flow:

`/register#invite=<capability>` → server-validated invite → email ownership
code → versioned legal acceptance → Better Auth credential account →
`/profile-setup`.

Existing members use email/password. Password recovery uses Better Auth's
short-lived, one-time reset token and the configured transactional email
adapter. Production, main, external OAuth applications and existing provider
rows are outside this change.

## Current branch evidence

- Branch: `feat/alpha-profile-identity-20260828`
- Exact implementation base before this change: `1ff14118a5e99f1fd0ecd46ab990b6e2c0069a43`
- Verification database: Neon branch `br-hidden-rice-aj5bed7o`
- At inspection time that isolated branch contained 5 users, 5 accounts, 5
  credential accounts, 0 Google accounts, 0 Naver accounts, and 0 identity
  verification rows. These counts are not a statement about Production.

## Security decision

- Invite preparation is a read-only fragment exchange. The fragment is
  removed before the POST and raw capability is not placed in browser storage,
  logs or analytics.
- Email verification is a separate pre-account HMAC challenge. Its target
  email comes from the invite row; the client cannot substitute another email.
  Attempts, expiry, resend cooldown, IP/invite/email rate limits and one-time
  consumption are enforced in `alpha_email_verifications`.
- User and credential-account creation is invite-gated in the server hook.
  Better Auth's Drizzle adapter runs the user/account pair in one transaction;
  the application transaction then consumes the email proof and invite and
  records legal acceptance, with failed-finalization compensation preserved.
- Account linking remains disabled. Existing credential accounts are never
  overwritten by invite signup. An existing OAuth-only account can obtain a
  credential through an email reset link only after current mailbox ownership
  is proved; provider rows are not deleted here.
- Google/Naver UI, provider configuration and callbacks are removed from this
  branch. Legacy OAuth endpoint paths return 404 and do not enter Better Auth.
  External OAuth credentials/apps are retained for separate, explicitly
  approved cleanup.

## Email delivery boundary

The adapter uses `RESEND_API_KEY` and `UNSTANDARD_EMAIL_FROM`. Missing or failed
delivery fails invite-code sending closed; the reset request remains
enumeration-safe and reports the same generic response. No mock sender or
fixed code is allowed in Preview/Production. Sender/domain authentication and
actual inbox receipt remain deployment acceptance evidence.

## Required Preview acceptance evidence

1. Issue one non-production invite through the operator UI/server route.
2. In a fresh browser, complete invite preparation, receive the real code,
   verify it, accept all required legal versions, create a password, and land
   on `/profile-setup`.
3. Sign out and sign back in with the same email/password.
4. Request a reset, open the received link, set a new password, verify the old
   password fails and the new one works, and verify reset-token reuse fails.
5. Verify missing invite, wrong/mismatched/expired/reused code, missing legal
   acceptance, duplicate email and concurrent signup fail without an
   unintended user/account/invite delta.
6. Record count-only before/after evidence: normal signup is users `+1`,
   accounts `+1`, credential accounts `+1`, Google/Naver `0`, identity rows
   `0`; challenge/rate-limit rows are reported separately as expected changes.

Didit identity checks, safety gates, privacy review and operational seat
conditions remain separate release gates. Do not call this
`CLOSED_ALPHA_READY` until those gates are independently evidenced.
