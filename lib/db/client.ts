import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { requireDatabaseUrl } from "@/lib/db/config";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";
import { schema } from "@/lib/db/schema";
import type { DbExecutor } from "@/lib/db/types";

configureNeonWebSocket();
// The local Postgres E2E harness sets this flag to keep a direct WebSocket
// session open across API requests. Preview/serverless deployments retain the
// single-query HTTP transport unless explicitly running that test harness.
neonConfig.poolQueryViaFetch = process.env.UNSTANDARD_TEST_POSTGRES_WEBSOCKET !== "yes";

export type AppDatabase = DbExecutor;

let poolInstance: Pool | null = null;
let dbInstance: AppDatabase | null = null;

function getPool(): Pool {
  if (poolInstance) {
    return poolInstance;
  }

  poolInstance = new Pool({ connectionString: requireDatabaseUrl() });
  return poolInstance;
}

function integrationTransactionLogger() {
  if (process.env.DATABASE_ENV !== "test") return undefined;
  return {
    logQuery(query: string) {
      const command = query.trim().match(/^(BEGIN|COMMIT|ROLLBACK)\b/iu)?.[1]?.toUpperCase();
      if (!command) return;
      console.info(JSON.stringify({
        event: "integration.transaction",
        boundary: command,
        phase: "statement",
        transport: "pool_client",
      }));
    },
  };
}

/**
 * Lazy database handle with transaction support (Neon serverless Pool + WebSocket).
 */
export function getDb(): AppDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = drizzle(getPool(), { schema, logger: integrationTransactionLogger() });
  return dbInstance;
}

/** Close and reset the shared DB handle between integration tests only. */
export async function closeDatabasePoolForIntegrationTests(): Promise<void> {
  if (process.env.DATABASE_ENV !== "test") return;
  const pool = poolInstance;
  poolInstance = null;
  dbInstance = null;
  console.info(JSON.stringify({
    event: "integration.shared_pool_cleanup",
    phase: "start",
    open_pool: pool !== null,
  }));
  if (pool) await pool.end();
  console.info(JSON.stringify({
    event: "integration.shared_pool_cleanup",
    phase: "end",
    outcome: "PASS",
    closed_pool: pool !== null,
  }));
}

export async function pingDatabase(): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}
