# Security Checklist

## Auth

- [x] Better Auth server sessions (HttpOnly cookie)
- [x] Mock auth blocked in Preview/Production
- [x] Invite-only registration gate
- [x] Session API redacts email / full user id / tokens
- [x] Deployed adversarial Preview smoke PASS (`32/32` at P0 exact head)

## Data

- [x] Server-only `DATABASE_URL`
- [x] SQL uniqueness for reports/blocks/unlocks
- [x] Integration tests on real Postgres (`21/21` at P0 exact head)
- [x] npm production/tooling audit gates currently report zero vulnerabilities
- [x] Weekly npm and GitHub Actions Dependabot policy
- [ ] Production Neon branch identity + protection verified
- [ ] Production restore drill recorded
- [ ] Rate limiting / abuse guards (backlog)

## Authorization

- [x] `requireAuthenticatedUser()` on protected mutations
- [x] `assertOwnsResource()` helper
- [x] Reject body-supplied actor IDs in report validation
- [x] Full A/B HTTP smoke on Preview

## Operations

- [x] Operator-only, read-only Production readiness endpoint (fail closed)
- [x] Exact-SHA/hostname/DB-fingerprint Production evidence verifier
- [x] Separate closed-alpha operational attestation gate
- [ ] Account deletion procedure implemented and verified
- [ ] Incident, rollback, support, moderation, privacy, restore, and abuse attestations complete
