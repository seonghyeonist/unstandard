# Migration Correction Decision

## Status

No real PostgreSQL staging or production migration has been executed for the Neon/Drizzle rebuild.

## Decision

**Correct `drizzle/migrations/0000_initial.sql` in place. Do not add `0001` for invite reservation hardening.**

## Why

1. `0000_initial` has never been applied to a live Neon branch for this rebuild.
2. Invite finalization requires `users.invite_finalized_at`, `alpha_invites.reservation_nonce_hash`, and supporting indexes in the initial schema.
3. Adding `0001` now would imply a phantom applied `0000` history that does not exist outside local experimentation.
4. Drizzle's official migrator (`drizzle-orm/neon-http/migrator`) will record the corrected `0000` as the first ledger entry on first staging execution.

## Operator note

After the first real staging migration run begins, **do not rewrite `0000_initial.sql`**. Future corrections must be forward-only migrations.
