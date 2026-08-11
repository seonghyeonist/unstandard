# Troubleshooting

## `DATABASE_URL is not configured`

Set `UNSTANDARD_RUNTIME_MODE=database` and provide `DATABASE_URL` in `.env.local` or Vercel env.

## `Registration is invite-only`

Claim an invite at `/register` before sign-up. Create invites with `npm run alpha:invite:create`.

## `db:migrate` refuses to run

Set `DATABASE_ENV` and `UNSTANDARD_CONFIRM_DB_MIGRATE=yes`.

## Mock mode in production

Preview/Production must use `UNSTANDARD_RUNTIME_MODE=database`. Mock auth is development-only.

## Build passes but DB features 503

Persistence requires both `UNSTANDARD_RUNTIME_MODE=database` and a reachable `DATABASE_URL`.
