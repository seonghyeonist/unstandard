# Invite Finalization Limitation

Better Auth user creation and application invite consumption cannot share a single PostgreSQL transaction.

## Implemented compensation model

1. **Atomic reserve** — one conditional `UPDATE` moves `alpha_invites` from `pending` to `reserved` and stores only `reservation_nonce_hash`.
2. **Ticket binding** — registration ticket cookie is HMAC-signed over invite ID, normalized email, reservation capability, and expiry.
3. **Pre-signup verify** — Better Auth `before` hook verifies ticket signature and current DB reservation state.
4. **Post-create finalize** — `databaseHooks.user.create.after` performs conditional consume; failure triggers `compensateFailedRegistration()` (user row delete via cascade).
5. **Session gate** — `getAuthenticatedUser()` and sign-in hook reject users without `invite_finalized_at`.

## Honest limits

- A crash between user insert and compensation may leave a brief orphan row until the next failed session read triggers sign-out and manual cleanup.
- Replay of a consumed ticket is blocked by conditional consume and finalized-user checks.
- This is **not** full cross-system atomicity; it is explicit reservation/finalization with compensation.
