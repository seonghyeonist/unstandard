import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { assertTestDatabaseEnv } from "@/lib/config/database-env";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";
import { closeDatabasePoolForIntegrationTests } from "@/lib/db/client";
import { requireDestructiveTestConfirmation, requireTestDatabaseUrl } from "@/lib/db/migration-guards";
import { schema } from "@/lib/db/schema";
import { assertDatabaseReachable } from "@/lib/readiness/integration-database";
import type { DbExecutor } from "@/lib/db/types";

configureNeonWebSocket();
// Use the persistent WebSocket Pool transport in the disposable integration
// harness when the runner explicitly enables it. CI callers without the flag
// retain the normal fetch transport.
neonConfig.poolQueryViaFetch = process.env.UNSTANDARD_TEST_POSTGRES_WEBSOCKET !== "yes";

export type IntegrationDb = DbExecutor;
export type IntegrationSql = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>) & {
  query(query: string): Promise<Record<string, unknown>[]>;
};

const integrationPools = new Set<Pool>();
let sharedIntegrationPool: Pool | null = null;
let sharedIntegrationDatabaseUrl: string | null = null;

function getSharedIntegrationPool(url: string): Pool {
  if (sharedIntegrationPool) {
    if (sharedIntegrationDatabaseUrl !== url) {
      throw new Error("one integration suite cannot use multiple database URLs");
    }
    return sharedIntegrationPool;
  }

  sharedIntegrationPool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 15_000,
    query_timeout: 45_000,
    statement_timeout: 45_000,
    lock_timeout: 10_000,
    idle_in_transaction_session_timeout: 60_000,
  });
  sharedIntegrationDatabaseUrl = url;
  integrationPools.add(sharedIntegrationPool);
  return sharedIntegrationPool;
}

export async function closeIntegrationPools(): Promise<void> {
  const pools = [...integrationPools];
  console.info(JSON.stringify({
    event: "integration.pool_cleanup",
    phase: "start",
    open_pool_count: pools.length,
  }));
  const results = await Promise.allSettled(pools.map((pool) => pool.end()));
  for (const pool of pools) {
    integrationPools.delete(pool);
    if (pool === sharedIntegrationPool) {
      sharedIntegrationPool = null;
      sharedIntegrationDatabaseUrl = null;
    }
  }
  const failed = results.filter((result) => result.status === "rejected").length;
  console.info(JSON.stringify({
    event: "integration.pool_cleanup",
    phase: "end",
    outcome: failed === 0 ? "PASS" : "FAIL",
    closed_pool_count: pools.length - failed,
    failed_pool_count: failed,
  }));
  if (failed > 0) throw new Error("integration pool cleanup failed");
}

export async function closeIntegrationDatabases(): Promise<void> {
  await closeIntegrationPools();
  await closeDatabasePoolForIntegrationTests();
}

export function getIntegrationDatabaseUrl(): string {
  assertTestDatabaseEnv();
  requireDestructiveTestConfirmation();
  return requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

export function createIntegrationDb(url = getIntegrationDatabaseUrl()): IntegrationDb {
  if (process.env.DATABASE_ENV !== "test") {
    throw new Error("Integration database helper requires DATABASE_ENV=test");
  }

  return drizzle(getSharedIntegrationPool(url), { schema });
}

/** Parameterized SQL tag backed by the persistent Pool used by integration tests. */
export function createIntegrationSql(url = getIntegrationDatabaseUrl()): IntegrationSql {
  if (process.env.DATABASE_ENV !== "test") {
    throw new Error("Integration SQL helper requires DATABASE_ENV=test");
  }

  const pool = getSharedIntegrationPool(url);

  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let statement = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      statement += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const result = await pool.query(statement, values);
    return result.rows as Record<string, unknown>[];
  }) as IntegrationSql;

  sql.query = async (statement: string) => {
    const result = await pool.query(statement);
    return result.rows as Record<string, unknown>[];
  };

  return sql;
}

export { assertDatabaseReachable };
