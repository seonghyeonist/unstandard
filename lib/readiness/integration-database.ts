import { neon } from "@neondatabase/serverless";

/**
 * Verify that a disposable PostgreSQL integration database is reachable.
 *
 * This lives outside tests/ so production type-checking and Vercel builds do
 * not depend on the test-only integration helper being present in the deploy
 * file set.
 */
export async function assertDatabaseReachable(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  await sql`SELECT 1`;
}
