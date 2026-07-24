# Active Schema Table Callers

Every table in the rebuild schema is tied to an active caller or an explicit alpha gate.

| Table | Active caller(s) | Notes |
|-------|------------------|-------|
| `users` | Better Auth adapter (`lib/auth/auth.ts`), `getAuthenticatedUser()` (`lib/auth/server.ts`), invite finalization (`lib/auth/invite-finalization.ts`) | `invite_finalized_at` blocks unfinalized invite signups |
| `sessions` | Better Auth session lifecycle | Cascade delete from `users` |
| `accounts` | Better Auth email/password provider | Cascade delete from `users` |
| `verifications` | Better Auth verification flows | Reserved for email verification expansion |
| `profiles` | `ensureProfileForUser()` (`lib/db/repositories/profile-bootstrap.ts`), onboarding persistence | Unique per `user_id` |
| `profile_private` | Private profile content loaders | Cascade delete from `profiles` |
| `questions` | `scripts/db/seed.ts`, onboarding answer route | Seed idempotency tested in integration |
| `answers` | `lib/db/repositories/answers.repository.ts`, onboarding API | Unique (`user_id`, `question_id`) |
| `depth_evaluations` | Answers repository during onboarding save | One evaluation per answer |
| `reports` | `lib/db/repositories/reports.repository.ts`, `POST /api/reports` | Partial unique open dedup index |
| `blocks` | `lib/db/repositories/blocks.repository.ts`, integration suite | No public HTTP route yet |
| `unlocks` | `lib/db/repositories/unlocks.repository.ts`, integration suite | Preview unlock path still cookie-based |
| `alpha_invites` | `lib/auth/invite-gate.ts`, `scripts/alpha/invite.ts`, claim API | Atomic reserve/consume + stale release |
| `app_config` | `scripts/db/seed.ts` | Alpha closed flag |

## Retired / not preserved

- Retired third-party auth backend tables and routes
- Legacy RLS smoke and staging push scripts

## Better Auth compatibility

`users`, `sessions`, `accounts`, and `verifications` mirror Better Auth Drizzle adapter expectations with plural table names via `usePlural: true`.

## Foreign-key delete behavior

- User-owned rows cascade on `users` delete (compensation path for failed invite finalization)
- `alpha_invites.consumed_by_user_id` uses `ON DELETE SET NULL` to preserve audit without blocking user cleanup

## Index coverage for conditional updates

- `alpha_invites_claim_idx` on (`code_hash`, `email_normalized`, `status`)
- `alpha_invites_reserved_stale_idx` on (`status`, `reserved_at`)
- `reports_open_dedup_unique`, `blocks_pair_unique`, `unlocks_viewer_profile_unique`
