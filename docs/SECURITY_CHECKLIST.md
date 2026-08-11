# Security Checklist

## Auth

- [x] Better Auth server sessions (HttpOnly cookie)
- [x] Mock auth blocked in Preview/Production
- [x] Invite-only registration gate
- [x] Session API redacts email / full user id / tokens
- [ ] Deployed adversarial smoke PASS

## Data

- [x] Server-only `DATABASE_URL`
- [x] SQL uniqueness for reports/blocks/unlocks
- [ ] Integration tests on real Postgres
- [ ] Rate limiting / abuse guards (backlog)

## Authorization

- [x] `requireAuthenticatedUser()` on protected mutations
- [x] `assertOwnsResource()` helper
- [x] Reject body-supplied actor IDs in report validation
- [ ] Full A/B HTTP smoke on Preview
