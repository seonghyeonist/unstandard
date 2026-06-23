# DB Schema Draft — Unstandard (Supabase/PostgreSQL)

> Review-only draft. Not applied to production. See `supabase/migrations/`.

## Tables

### profiles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| nickname | text | public after onboarding |
| city | text | optional public |
| teaser | text | public card text |
| onboarded_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Private fields (letter, small_joys, soft_facts) → separate table or JSONB with RLS, **not** sent to client before unlock.

### questions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| prompt | text | |
| helper | text | |
| active | boolean | |

### answers

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK profiles | author |
| question_id | uuid FK | |
| target_profile_id | uuid FK | unlock target |
| answer_text | text | **private** until unlock rules pass |
| created_at | timestamptz | |

### depth_evaluations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| answer_id | uuid FK | |
| user_id | uuid FK | |
| verdict | text | PASS/REVIEW/REJECT |
| score | numeric | **admin/system only in UI** |
| path | text | internal |
| reason_codes | text[] | mapped to user copy server-side |
| model_version | text | audit |
| created_at | timestamptz | |

### reports

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| reporter_user_id | uuid FK | |
| target_type | text | profile/answer/message |
| target_id | text | |
| reason | text | |
| status | text | OPEN default |
| created_at | timestamptz | |

### blocks

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| blocker_user_id | uuid FK | |
| blocked_user_id | uuid FK | |
| created_at | timestamptz | |

### app_config

| Column | Type | Notes |
|--------|------|-------|
| key | text PK | |
| value | jsonb | |
| updated_at | timestamptz | |

Keys (future): `depth_score_threshold`, `depth_fast_track_score`, `fast_track_min_length`, `onboarding_q_count`, etc.

### events

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| event_type | text | |
| payload | jsonb | minimize raw PII |
| created_at | timestamptz | |

### conversations / messages

Deferred to post-alpha matching phase. Skeleton in `0001_initial_schema.sql`.

### unlocks

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| viewer_user_id | uuid FK | |
| profile_id | uuid FK | |
| unlocked_at | timestamptz | server-authoritative |

## RLS summary

See `supabase/migrations/0002_rls_policies.sql` and adversarial table in `docs/SECURITY_CHECKLIST.md`.
