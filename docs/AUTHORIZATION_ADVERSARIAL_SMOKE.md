# Authorization Adversarial Smoke

HTTP-boundary smoke replacing legacy direct-SQL browser tests.

## Command

```bash
export SMOKE_BASE_URL=https://<preview-host>
export SMOKE_USER_A_EMAIL=...
export SMOKE_USER_A_PASSWORD=...
export SMOKE_USER_B_EMAIL=...
export SMOKE_USER_B_PASSWORD=...
npm run smoke:authorization
```

## Required scenarios

- anonymous denied on protected session data
- user A session valid
- user B session valid
- A own-resource success
- A → B read/update/delete denial
- forged body `userId` ignored
- duplicate report / block / unlock conflicts
- logout invalidates session
- session endpoint redacts sensitive fields

Output redacts emails, passwords, cookies, tokens, and full IDs.

Pass only when every required case exits 0.
