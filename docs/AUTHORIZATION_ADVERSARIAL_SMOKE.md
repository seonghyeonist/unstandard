# Authorization Adversarial Smoke

HTTP-boundary smoke for the **deployed Alpha HTTP surface only**.

DB-only proofs (block/unlock uniqueness, invite replay under load) belong in `npm run test:integration`.

## Command

```bash
export SMOKE_BASE_URL=https://<preview-host>
export SMOKE_VERCEL_PROTECTION_BYPASS=... # when Preview protection is enabled
export SMOKE_USER_A_EMAIL=...
export SMOKE_USER_A_PASSWORD=...
export SMOKE_USER_B_EMAIL=...
export SMOKE_USER_B_PASSWORD=...
export SMOKE_USER_A_PROFILE_ID=... # reporter's own profile id
export SMOKE_USER_B_PROFILE_ID=... # cross-user read/report target
npm run smoke:authorization
```

## Required deployed HTTP cases (must all PASS)

- `anonymous_denied`
- `user_a_login`, `user_b_login`
- `user_a_session`, `user_b_session`
- `user_a_owns_session`, `user_b_owns_session`
- `user_a_cannot_read_user_b_private_profile`
- `forged_reporter_id_rejected` (`targetType: profile`, no client `reporterUserId` on self-report)
- `self_report_rejected` (A reports A's own profile id)
- `duplicate_open_report_is_idempotent` (first `201`, repeat `200`, same report id)
- `session_response_redacted`
- `logout_invalidates_session`
- `revoked_session_rejected`

## Future / not applicable (reported separately, not required for PASS)

- HTTP block duplicate rejection (no route)
- HTTP unlock duplicate rejection (cookie-based alpha path)
- HTTP profile mutation denial (no route)
- HTTP cross-user answer mutation denial (no route)

## Report contract

- Canonical `targetType` values: `profile`, `answer`, `message` (lowercase)
- Duplicate open report by same actor/target: HTTP `200`, same id, no second row

Output redacts emails, passwords, cookies, tokens, and full IDs.

Pass only when every required HTTP case exits `0`.
