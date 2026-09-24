import { Pool, neonConfig } from "@neondatabase/serverless";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";

const DATABASE_REACHABILITY_TIMEOUT_MS = 60_000;

/**
 * Verify that a disposable PostgreSQL integration database is reachable.
 *
 * This lives outside tests/ so production type-checking and Vercel builds do
 * not depend on the test-only integration helper being present in the deploy
 * file set.
 */
export async function assertDatabaseReachable(databaseUrl: string): Promise<void> {
  configureNeonWebSocket();
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({ connectionString: databaseUrl });
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("integration database reachability timed out")),
          DATABASE_REACHABILITY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    await pool.end();
  }
}
