# Handoff Session

## Current stack

- Neon PostgreSQL (server-only)
- Drizzle ORM + `drizzle/migrations`
- Better Auth
- Invite-only closed alpha registration

## Branch

`cursor/neon-drizzle-better-auth-rebuild-909d`

## Local commands

```bash
npm ci
npm run check
npm run guard:no-legacy-backend
npm run guard:boundaries
```

## Alpha

**BLOCKED** — needs Neon credentials, migration apply, integration + Preview smoke.
