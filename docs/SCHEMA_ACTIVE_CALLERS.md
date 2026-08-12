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
| `unlocks` | `lib/db/repositories/unlocks.repository.ts`, database unlock API, integration suite | Database runtime uses DB rows; cookie path is local mock only |
| `alpha_invites` | `lib/auth/invite-gate.ts`, `lib/alpha/invite-admin.ts`, operator CLI, claim API | Atomic reserve/consume; DB trigger enforces 50 Stage 1 seats |
| `app_config` | `scripts/db/seed.ts` | Alpha closed flag |
| `rate_limits` | Better Auth + `lib/security/rate-limit.ts` | Shared serverless-safe limiter state |
| `support_requests` | `POST /api/support`, Settings support form | User-owned; cascade delete |
| `messages` | `lib/db/repositories/messages.repository.ts`, `GET/POST /api/messages/[profileId]` | Unlock + bidirectional block authorization; cascade delete |
| `alpha_activity_days` | `getAuthenticatedUser()` via alpha activity repository | One content-free row per user/UTC day for D7 |
| `alpha_profile_exposures` | public profile API via exposure repository | Unique viewer/target relation only; no text, repeat count, or timestamp copied |
| `waitlist_entries` | `GET/POST/DELETE /api/waitlist` | Consented email; hashed deletion capability |
| `waitlist_visit_days` | waitlist repository | Unique UTC revisit days; cascade with waitlist entry |

## Retired / not preserved

- Retired third-party auth backend tables and routes
- Legacy RLS smoke and staging push scripts

## Better Auth compatibility

`users`, `sessions`, `accounts`, and `verifications` mirror Better Auth Drizzle adapter expectations with plural table names via `usePlural: true`.

## Foreign-key delete behavior

- User-owned rows cascade on `users` delete (compensation path for failed invite finalization)
- User-owned messages/activity/exposures cascade; message-target reports are removed by the user-deletion trigger
- `alpha_invites.consumed_by_user_id` is `ON DELETE SET NULL`, while the deletion trigger removes the linked invite/email row
- Waitlist records are independent of accounts and delete through the waitlist capability path

## Index coverage for conditional updates

- `alpha_invites_claim_idx` on (`code_hash`, `email_normalized`, `status`)
- `alpha_invites_reserved_stale_idx` on (`status`, `reserved_at`)
- `reports_open_dedup_unique`, `blocks_pair_unique`, `unlocks_viewer_profile_unique`
- `alpha_activity_days_user_date_unique`, `alpha_profile_exposures_viewer_target_unique`
- `waitlist_entries_email_unique`, `waitlist_visit_days_entry_date_unique`
