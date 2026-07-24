# Better Auth Security Model

- Email/password auth with minimum 10 character passwords
- HttpOnly session cookies; `Secure` on HTTPS deployments
- `SameSite=Lax` default
- CSRF + origin checks enabled in Better Auth
- Trusted origins from `BETTER_AUTH_URL`, `UNSTANDARD_APP_URL`, and localhost in development only
- No wildcard `*.vercel.app` trust
- `GET /api/auth/session` returns only `{ nickname, onboarded, idPrefix }`
- Invite gate blocks `/sign-up/email` without a valid registration ticket cookie
- Raw invite codes are never stored or logged — only hashes

See `lib/auth/auth.ts` and `lib/auth/invite-gate.ts`.
