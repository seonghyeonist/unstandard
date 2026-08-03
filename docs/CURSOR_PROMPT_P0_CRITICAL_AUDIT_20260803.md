# Cursor prompt — follow-up review

Use this prompt in Cursor after the draft PR and Preview deployment exist:

```text
Review the current branch and its Vercel Preview as a skeptical security and
readiness reviewer. Do not modify Production, do not create human labels, and
do not treat synthetic/unit/AI evidence as Neon or human evidence.

1. Confirm the PR head SHA equals the Vercel Preview deployment SHA.
2. Review the diff for server-side auth coverage, database-runtime fail-closed
   behavior, private no-store responses, generic error mapping, and input bounds.
3. Run npm test, npm run lint, npm run typecheck, npm run build,
   npm run guard:no-legacy-backend, and npm run guard:boundaries.
4. Run npm run test:integration only when a disposable TEST_DATABASE_URL is
   explicitly supplied; otherwise report BLOCKED_EXTERNAL and write no PASS
   artifact.
5. Verify that /app and /onboarding are protected by server layouts and that
   query-string debug tokens are rejected.
6. Inspect Preview build/runtime logs for errors, but do not expose secrets,
   cookies, emails, raw answers, database URLs, or embedding vectors.
7. Report findings by severity and keep Alpha readiness BLOCKED_EXTERNAL until
   separate Preview DB evidence, A/B HTTP smoke, combined exact-SHA evidence,
   and independent human labels are complete.
```
