# Invite Finalization Limitation

Better Auth user creation and application invite consumption cannot share a single PostgreSQL transaction.

## Implemented compensation model

1. **Atomic reserve** — one conditional `UPDATE` moves `alpha_invites` from `pending` to `reserved` and stores only `reservation_nonce_hash`.
2. **Ticket binding** — registration ticket cookie is HMAC-signed over invite ID, normalized email, reservation capability, and expiry.
3. **Pre-signup verify** — Better Auth `before` hook verifies ticket signature and current DB reservation state.
4. **Transactional finalize** — `finalizeInviteRegistration()` runs in one Drizzle/PostgreSQL transaction on the Neon serverless Pool driver:
   - conditional invite consume
   - `users.invite_finalized_at` update with affected-row check
   - idempotent profile bootstrap
5. **Compensation** — transaction or consume failure deletes the Better Auth user row (cascade cleanup). Compensation failure is logged with sanitized codes only.
6. **Session gate** — `getAuthenticatedUser()` and sign-in hook reject users without `invite_finalized_at`.

## Honest limits

- Better Auth user insertion remains outside the application transaction.
- A crash between user insert and finalize attempt still requires compensation on the next failed finalize/session read.
- Replay of a consumed ticket is blocked by conditional consume and finalized-user checks.
- Migrations still use the Neon HTTP driver (no migrator transactions); runtime finalization uses Pool/WebSocket transactions.

## Proof harness note (P0.2)

Invite finalization success/rollback are proven by **real PostgreSQL integration** cases
(`invite_finalization_success`, `invite_finalization_rollback`) via `npm run test:integration`,
not by deployed HTTP smoke and not by hand-authored PASS JSON.

Artifacts and readiness validation use Artifact Version 1 (`lib/readiness/proof-artifact.ts`).
Node runtime pin: **24.x**.
