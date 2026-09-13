# Vercel Git delivery reconnect probe — 2026-09-12

This non-runtime document records the recovery probe for PR #80.

- Vercel project: `unstandard-m9qj`
- Repository: `seonghyeonist/unstandard`
- Branch: `feat/alpha-profile-identity-20260828`
- The project Git connection was disconnected and reconnected to the same repository through Vercel Project Settings.
- Vercel displayed the repository as connected again immediately afterward.
- A same-tree Git commit was then issued to test whether delivery resumed.

The document contains no credentials, tokens, invite values, or personal test data. It exists only to produce a content-changing Git push and preserve an operational audit trail; it has no runtime effect.

## Exact-head recovery trigger — 2026-09-13

PR #80 was re-read at `1abb6b0952e42ac17be1863d80ae862234a5ef64`
before this trigger. GitHub CI and Rebuild CI were successful for that SHA, but
the latest Git-linked READY Preview still referred to
`6953142be3aec50fddf274ddb3e339209efdc11b`. Three later direct-source uploads
were rejected as acceptance evidence: two failed closed because Preview
canonical-origin variables were unavailable to those uploads, and one lacked
the repository lockfile.

Before issuing this content-only trigger, the branch passed `npm run check`
(351 tests), both security audits with zero reported vulnerabilities,
`guard:no-legacy-backend`, and `guard:boundaries`. A count-only query against
the non-default Neon verification branch recorded 5 users, 5 total accounts,
5 credential accounts, 0 Google accounts, 0 Naver accounts, 0 identity rows,
and 0 legal-acceptance rows. No mailbox, invite, account, or database mutation
was performed.

This edit intentionally changes no runtime code. Its sole purpose is to emit a
fresh Git branch event so Vercel can create a Git-linked Preview for the new PR
head. Production, `main`, Production environment variables, and the Production
database remain outside the operation.
