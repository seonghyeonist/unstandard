# DB Schema Draft

Source of truth: `lib/db/schema/*.ts` and `drizzle/migrations/0000_initial.sql`.

## Auth tables (Better Auth)

- `users`, `sessions`, `accounts`, `verifications`

## Product tables

- `profiles` (1:1 `users.id` via `profiles.user_id` text FK)
- `profile_private`
- `questions`, `answers`, `depth_evaluations`
- `reports`, `blocks`, `unlocks`
- `alpha_invites`, `app_config`

## Notes

- Better Auth user IDs are `text`
- Product entity IDs are UUID (`profiles.id`, etc.)
- Email is never used as a foreign key
- Duplicate open reports, blocks, and unlocks prevented by unique indexes
