# Runtime contract matrix (P0 DB-backed unlock)

| Surface | Local mock | Preview database | Production database |
|---|---|---|---|
| auth | mock cookie session | Better Auth + Neon | Better Auth + Neon |
| public candidates | mock `c1/c2/c3` via `/api/candidates` | Neon onboarded `profiles.id` UUIDs | Neon onboarded `profiles.id` UUIDs |
| unlock question | mock candidate.question | `app_config.unlock.active_question_id` → `questions` | same as Preview |
| unlock submit | cookie set on PASS | `unlock_attempts` + `unlocks` upsert on PASS | same as Preview |
| unlock status | unlock cookie | `unlocks(viewer_user_id, profile_id)` | same as Preview |
| private profile | mock private + cookie | `profile_private` after DB unlock row | same as Preview |
| authorization source | signed unlock cookie | DB `unlocks` row only | DB `unlocks` row only |

## Split-brain before this slice

- auth/onboarding: DB-backed
- candidate/private/unlock: mock-backed
- Preview: `UNSTANDARD_RUNTIME_MODE` defaults to `database` when `VERCEL_ENV` is set
- Result: structural 503 on unlock/private routes

## Mode precedence note

`getRuntimeMode()` applies explicit `UNSTANDARD_RUNTIME_MODE=mock|database` **before** the `VERCEL_ENV` default. Setting Preview to `mock` would restore cookie unlock but is **not** an accepted remediation for this P0 slice.
