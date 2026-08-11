# Backend Rebuild Audit

> Inventory completed before legacy backend removal.  
> Source: `cursor/staging-rls-execution-909d` @ `476218c7c8e9cf2774feb8d1981ce7f933cb4c6f`

## New stack

- Neon PostgreSQL
- Drizzle ORM + committed SQL migrations
- Better Auth (self-hosted)
- Invite-only registration gate
- Application-layer authorization (no browser DB access)

## Preserved (provider-neutral)

- Repository interfaces and DTOs under `lib/server/persistence/`
- Security validation under `lib/security/`
- Mock depth evaluation under `lib/depth/`
- Client session reader `lib/api/auth.ts` (HTTP only)
- UI components and mock demo data

## Replaced

- Legacy auth routes → `app/api/auth/[...all]/route.ts`
- Legacy persistence adapters → `lib/db/repositories/*`
- Legacy migration tooling → `drizzle/migrations/*` + `npm run db:*`
- Legacy smoke harness → `scripts/smoke/authorization-adversarial.ts`

## Deleted surface

- Vendor-specific client/server SDK modules
- Browser database adapters
- Legacy SQL migration tree
- Legacy staging login / migration automation docs

See `docs/LEGACY_BACKEND_RETIREMENT.md` for retirement notes without vendor implementation detail.
