# Neon Bootstrap Runbook

## 1. Create Neon projects

- **Staging branch** for Vercel Preview
- **Production branch** separate from staging (never share writable credentials)

Record only branch names in tickets — never commit connection strings.

## 2. Vercel Preview env (names only)

| Variable | Required |
|----------|----------|
| `UNSTANDARD_RUNTIME_MODE` | `database` |
| `DATABASE_ENV` | `staging` |
| `DATABASE_URL` | staging connection string |
| `BETTER_AUTH_SECRET` | 32+ char secret |
| `BETTER_AUTH_URL` | preview app URL |
| `UNSTANDARD_APP_URL` | preview app URL |
| `AUTH_COOKIE_SECRET` | unlock cookie secret |
| `ALPHA_INVITE_PEPPER` | optional; defaults to auth secret |

## 3. Migrate + seed staging

```bash
export DATABASE_ENV=staging
export UNSTANDARD_CONFIRM_DB_MIGRATE=yes
npm run db:migrate
npm run db:seed
npm run db:check
```

## 4. Create alpha invites

```bash
npm run alpha:invite:create -- --email tester@example.com
```

## 5. Smoke

```bash
export SMOKE_BASE_URL=https://<preview-host>
npm run smoke:authorization
```
