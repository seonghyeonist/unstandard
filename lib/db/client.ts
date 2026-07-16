import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { requireDatabaseUrl } from "@/lib/db/config";
import { schema } from "@/lib/db/schema";
import type { DbExecutor } from "@/lib/db/types";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

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

/**
 * Lazy database handle with transaction support (Neon serverless Pool + WebSocket).
 */
export function getDb(): AppDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = drizzle(getPool(), { schema });
  return dbInstance;
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
