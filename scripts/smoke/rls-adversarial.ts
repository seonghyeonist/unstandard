/**
 * RLS adversarial smoke test placeholder.
 *
 * This script is intentionally a stub. The full staging-only RLS adversarial
 * smoke test lives in PR #35 (branch: cursor/rls-adversarial-smoke-2aa9).
 *
 * Do NOT merge PR #35 until after:
 *   1. Target is confirmed as Unstandard-staging only.
 *   2. migrations are applied via `npm run db:staging:push` (or verified already applied).
 *   3. `npm run db:staging:dry-run` shows no unexpected diff.
 *   4. Founder is healthy enough to review output.
 *
 * Required env once the real implementation is swapped in:
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY
 *   USER_A_JWT
 *   USER_B_JWT
 *   TEST_QUESTION_ID (default: 22222222-2222-2222-2222-222222222222)
 *
 * This script does NOT use SUPABASE_SERVICE_ROLE_KEY.
 */

console.error("[smoke:rls] placeholder: swap this file with the implementation from PR #35.");
console.error("[smoke:rls] branch: cursor/rls-adversarial-smoke-2aa9 (do not merge before migration dry-run).");
process.exit(1);
