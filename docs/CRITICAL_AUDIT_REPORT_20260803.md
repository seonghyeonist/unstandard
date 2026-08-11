# Critical Code Audit and Readiness Report — 2026-08-03

## Executive result

The application code was audited from the current Preview-linked branch and the
fixes that can be proven locally were applied on:

```text
branch: agent/p0-critical-audit-20260803
base:   cursor/neon-drizzle-better-auth-rebuild-909d
base:   cf87a2f2273385efe49d7314f76ceae231b0f305
```

The result is **locally verified code**, not Alpha approval. The external gates
that require a real disposable database, a separate Preview database, deployed
HTTP smoke with A/B users, and independent human labels remain blocked.

## Findings resolved

1. **Page authorization was client-only.** Added server layouts for `/app` and
   `/onboarding`; the server guard redirects unauthenticated or incorrectly
   onboarded users before rendering protected content. The optimistic proxy
   remains only an early redirect and uses path-segment boundaries.
2. **Mock-backed private routes could look database-backed.** In database
   runtime, answer unlock, unlock status, and private profile routes now fail
   closed with a private `503` until their Neon-backed implementations exist.
3. **Private JSON responses could be cacheable or expose implementation detail.**
   Auth-sensitive responses consistently use `privateJson` (`private,
   no-store`, `Vary: Cookie`); authentication/database errors are mapped to
   generic client-safe messages.
4. **Debug authentication accepted a URL query token.** It now accepts only a
   constant-time-compared `Authorization: Bearer` header; query-string tokens
   are rejected.
5. **Unlock input validation was incomplete.** Body shape, profile ID, and
   answer length are checked before evaluation; oversized or malformed input is
   rejected without raw error reflection.
6. **Next 16 migration left obsolete lint/runtime commands.** Migrated the
   deprecated `middleware.ts` convention to `proxy.ts`, converted the ESLint
   setup to native flat config, and changed TypeScript CLI scripts to
   `node --import tsx` so they work in restricted runners without IPC sockets.
7. **Production dependency audit reported upstream high findings.** Upgraded
   Next/React to `16.2.12`/`19.2.8` and pinned compatible `postcss 8.5.25` and
   `sharp 0.35.3` overrides. The production dependency audit now reports
   `high=0`, `critical=0`.

## Verification evidence

| Check | Result |
|---|---|
| `npm test` | PASS — 196 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next 16.2.12 production build |
| `npm run guard:no-legacy-backend` | PASS |
| `npm run guard:boundaries` | PASS |
| `npm audit --omit=dev --audit-level=high` | Production `high=0`, `critical=0` |
| `npm run test:integration` | `BLOCKED_EXTERNAL` — `TEST_DATABASE_URL` missing |

The unit test suite includes contract tests for the new page/auth, debug-token,
database-runtime fail-closed, cache, and proxy boundaries. The integration
runner's synthetic dependency-injection tests are not real PostgreSQL evidence.
No database migration, seed, invite creation, or user-data mutation was run.

The remaining five npm audit findings are moderate development-toolchain
findings in the Drizzle/esbuild chain with no upstream fix advertised by npm;
they are not included in the deployed application runtime dependency set.

## Gates deliberately not approved

### Human-label gate — `BLOCKED_HUMAN_LABELS`

AI-generated labels or model disagreement are not human ground truth. Approval
requires two independent human reviewers labeling the same canonical sample,
with disagreement adjudication and an auditable, non-raw evidence artifact.

### Alpha readiness — `BLOCKED_EXTERNAL`

The repository checklist remains blocked until all of the following are proven
against the exact deployed SHA:

- separate disposable integration DB and Preview DB;
- real migration/seed and PostgreSQL integration artifact;
- Vercel Preview SHA mapping and authenticated A/B HTTP smoke;
- invite-only account finalization;
- DB-backed reports, blocks, unlocks, and cross-user authorization;
- combined readiness artifact built from those exact observations.

Production remains untouched and `NOT_STARTED`.

## External actions authorized for the next phase

The owner authorized GitHub push and draft PR creation, Vercel Preview
deployment, and Preview-only Neon/test data operations when needed. Those rights
do not authorize Production promotion, destructive deletion, fabricated human
labels, or weakening a failed gate.
