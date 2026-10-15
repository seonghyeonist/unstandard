# Closed Alpha support workflow

Owner: `seonghyeonist`. First-response SLA: 240 minutes, per the Stage 1 runbook.

## Migration plan

Migration 0015 adds nullable `support_requests.assigned_to` and `support_events`.
The new table stores the acting role, assigned owner, resulting status, optional
member-visible response and server timestamp. Its ticket FK cascades on ticket
deletion; the existing ticket FK cascades on user deletion. No existing rows are
removed or rewritten. Existing requests have no invented historical responses.
Run the version-controlled migrator explicitly on an isolated database, verify
the ledger and cascade FK, then run it on the authorized nondefault RC branch.
Never run it during build or against Production as part of this checkpoint.

Rollback: deploy the preceding app commit; the additive schema is compatible.
Keep the added table and history unless a separately reviewed data-removal plan
is authorized. Do not delete support evidence as a rollback shortcut.

## Operations

1. Authenticate through `/operator/invites`, then open `/operator/support`.
2. Review the member's request privately, assign the founder owner and mark
   `IN_PROGRESS`. Save an actual response of 10–2000 characters. Closing requires
   a response. Responses appear under the member's settings support inbox.
3. Updates compare both prior status and the prior timestamp, in one transaction
   with the history insert. A stale/concurrent update returns 409; refresh and
   inspect the saved history before retrying.
4. The operator list records first response time and preserves an SLA breach even
   after a late response or closure. Do not classify a late test response as an
   on-time historical response. The console currently lists the latest 50 tickets.
5. Anonymous callers and ordinary members cannot operate tickets. Mutation calls
   require the same origin and an HttpOnly operator session. Member queries only
   return their own tickets and responses. All responses use private/no-store.

The operator actor denotes the authenticated shared operator role, not a claim
of individually verified staff identity. Response text and ticket identifiers
must not be included in public evidence, logs or GitHub comments. Do not send
mail unless a recipient and message have been explicitly authorized.

## Verification

`npm run check`, `npm run guard:boundaries`, `npm run guard:no-legacy-backend`.
On a fresh isolated database after migrations and seed:
`npm run test:auth:postgres -- support-lifecycle`.
That scenario creates only synthetic accounts, uses fixture-generated email
proofs (not inbox delivery), registers and signs in with passwords, checks support
ownership/replies/CSRF/concurrent replay/audit, withdraws an unverified profile,
denies passwordless and wrong-password deletion, deletes with the correct
password, checks stale cookies and support cascade, then removes its fixtures.
It never resets a password or synthesizes verified provider identity.
