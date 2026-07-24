import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { assertTestDatabaseEnv } from "@/lib/config/database-env";
import { requireDestructiveTestConfirmation, requireTestDatabaseUrl } from "@/lib/db/migration-guards";
import { schema } from "@/lib/db/schema";
import type { DbExecutor } from "@/lib/db/types";

neonConfig.webSocketConstructor = ws;

export type IntegrationDb = DbExecutor;

export function getIntegrationDatabaseUrl(): string {
  assertTestDatabaseEnv();
  requireDestructiveTestConfirmation();
  return requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

export function createIntegrationDb(url = getIntegrationDatabaseUrl()): IntegrationDb {
  if (process.env.DATABASE_ENV !== "test") {
    throw new Error("Integration database helper requires DATABASE_ENV=test");
  }

  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export async function assertDatabaseReachable(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
    await pool.end();
  }
}
