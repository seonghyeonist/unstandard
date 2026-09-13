import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { assertTestDatabaseEnv } from "@/lib/config/database-env";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";
import { requireDestructiveTestConfirmation, requireTestDatabaseUrl } from "@/lib/db/migration-guards";
import { schema } from "@/lib/db/schema";
import { assertDatabaseReachable } from "@/lib/readiness/integration-database";
import type { DbExecutor } from "@/lib/db/types";

configureNeonWebSocket();
// Match the production client: ordinary Pool queries use fetch, while
// transaction paths retain the WebSocket transport they require.
neonConfig.poolQueryViaFetch = true;

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

export { assertDatabaseReachable };
