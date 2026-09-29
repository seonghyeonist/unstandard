import { Pool, neon, neonConfig } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { drizzle } from "drizzle-orm/neon-serverless";
import { configureNeonWebSocket } from "./neon-websocket";
import type { SchemaSnapshotSqlClient } from "./schema-snapshot";
import {
  APPLICATION_SCHEMA,
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  REQUIRED_APPLICATION_TABLES,
  getDrizzleMigrationConfig,
  type MigrationLedgerRow,
} from "./migration-contract";

export {
  APPLICATION_SCHEMA,
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  REQUIRED_APPLICATION_TABLES,
  getDrizzleMigrationConfig,
} from "./migration-contract";

export {
  computeApplicationSchemaFingerprint,
  computeApplicationSchemaSnapshot,
  computeApplicationSchemaSnapshotWithSql,
  schemaContentDigest,
  canonicalizeSchemaSnapshot,
  schemaSnapshotJson,
} from "./schema-snapshot";

type MigrationInspectionSqlClient = SchemaSnapshotSqlClient & {
  query(query: string): Promise<Record<string, unknown>[]>;
};

const MIGRATION_QUERY_TIMEOUT_MS = 30_000;
const MIGRATION_TOTAL_TIMEOUT_MS = 600_000;
const MIGRATION_CONNECT_TIMEOUT_MS = 15_000;
const MIGRATION_POOL_CLOSE_TIMEOUT_MS = 5_000;

function logMigrationBoundary(
  boundary: string,
  phase: "start" | "end",
  details: Record<string, string | number> = {},
): void {
  console.info(JSON.stringify({ event: "db.migrate", boundary, phase, ...details }));
}

function safeMigrationErrorCode(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "MIGRATION_HTTP_TIMEOUT";
  }

  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{2,48}$/u.test(code)
    ? code
    : "MIGRATION_FAILED";
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, timeoutCode: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error(timeoutCode), {
            code: timeoutCode,
          }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runDrizzleMigrations(databaseUrl: string): Promise<void> {
  const originalFetch = globalThis.fetch;
  let requestId = 0;
  let transactionStarted = false;

  configureNeonWebSocket();
  neonConfig.poolQueryViaFetch = true;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: MIGRATION_CONNECT_TIMEOUT_MS,
    query_timeout: MIGRATION_QUERY_TIMEOUT_MS,
    statement_timeout: MIGRATION_QUERY_TIMEOUT_MS,
    lock_timeout: 10_000,
    idle_in_transaction_session_timeout: 60_000,
  });

  globalThis.fetch = async (input, init) => {
    const id = ++requestId;
    const startedAt = Date.now();
    const perRequestSignal = AbortSignal.timeout(MIGRATION_QUERY_TIMEOUT_MS);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, perRequestSignal])
      : perRequestSignal;
    logMigrationBoundary("http_request", "start", { request_id: id });

    try {
      const response = await originalFetch(input, { ...init, signal });
      logMigrationBoundary("http_request", "end", {
        request_id: id,
        outcome: "PASS",
        status: response.status,
        elapsed_ms: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      logMigrationBoundary("http_request", "end", {
        request_id: id,
        outcome: "FAIL",
        error_code: safeMigrationErrorCode(error),
        elapsed_ms: Date.now() - startedAt,
      });
      throw error;
    }
  };

  const db = drizzle(pool, {
    logger: {
      logQuery(query) {
        const command = query.trim().split(/\s+/u, 1)[0]?.toUpperCase();
        if (command === "BEGIN") {
          transactionStarted = true;
          logMigrationBoundary("first_transaction_begin", "start", { transport: "direct_websocket" });
        } else if (command === "COMMIT") {
          logMigrationBoundary("first_transaction_commit", "start");
        } else if (command === "ROLLBACK") {
          logMigrationBoundary("transaction_rollback", "start");
        }
      },
    },
  });

  try {
    logMigrationBoundary("database_reachability", "start");
    await pool.query("SELECT 1 AS ok");
    logMigrationBoundary("database_reachability", "end", { outcome: "PASS" });

    logMigrationBoundary("migration_batch", "start");
    await withTimeout(
      migrate(db, getDrizzleMigrationConfig()),
      MIGRATION_TOTAL_TIMEOUT_MS,
      "MIGRATION_TOTAL_TIMEOUT",
    );
    if (transactionStarted) {
      logMigrationBoundary("first_transaction_commit", "end", { outcome: "PASS" });
    }
    logMigrationBoundary("migration_batch", "end", {
      outcome: "PASS",
      http_requests: requestId,
    });
  } catch (error) {
    if (transactionStarted) {
      logMigrationBoundary("migration_transaction", "end", {
        outcome: "FAIL",
        error_code: safeMigrationErrorCode(error),
      });
    }
    logMigrationBoundary("migration_batch", "end", {
      outcome: "FAIL",
      error_code: safeMigrationErrorCode(error),
      http_requests: requestId,
    });
    throw Object.assign(
      new Error("database migration failed (" + safeMigrationErrorCode(error) + ")"),
      { code: safeMigrationErrorCode(error) },
    );
  } finally {
    logMigrationBoundary("pool_close", "start");
    globalThis.fetch = originalFetch;
    try {
      await withTimeout(pool.end(), MIGRATION_POOL_CLOSE_TIMEOUT_MS, "POOL_CLOSE_TIMEOUT");
      logMigrationBoundary("pool_close", "end", { outcome: "PASS" });
    } catch (error) {
      logMigrationBoundary("pool_close", "end", {
        outcome: "FAIL",
        error_code: safeMigrationErrorCode(error),
      });
      if (!transactionStarted) throw error;
    }
  }
}

export async function readMigrationLedger(databaseUrl: string): Promise<MigrationLedgerRow[]> {
  const sql = neon(databaseUrl) as unknown as MigrationInspectionSqlClient;
  return readMigrationLedgerWithSql(sql);
}

export async function readMigrationLedgerWithSql(
  sql: MigrationInspectionSqlClient,
): Promise<MigrationLedgerRow[]> {
  const schema = DRIZZLE_MIGRATIONS_SCHEMA;
  const table = DRIZZLE_MIGRATIONS_TABLE;

  const existence = await sql`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = ${schema} AND table_name = ${table}
    LIMIT 1
  `;
  if (existence.length === 0) {
    throw new Error(
      `missing migration ledger ${schema}.${table} — migrator configuration mismatch or migrate not run`,
    );
  }

  // Identifiers come from the shared contract constants only (not user input).
  const rows = await sql.query(
    `SELECT id, hash, created_at::text AS created_at FROM ${schema}.${table} ORDER BY id ASC`,
  );
  return (rows as Array<{ id: number; hash: string; created_at: string }>).map((row) => ({
    id: Number(row.id),
    hash: String(row.hash),
    created_at: String(row.created_at),
  }));
}

export async function assertRequiredApplicationTables(databaseUrl: string): Promise<string[]> {
  const sql = neon(databaseUrl) as unknown as SchemaSnapshotSqlClient;
  return assertRequiredApplicationTablesWithSql(sql);
}

export async function assertRequiredApplicationTablesWithSql(
  sql: SchemaSnapshotSqlClient,
): Promise<string[]> {
  const failures: string[] = [];
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${APPLICATION_SCHEMA}
      AND table_type = 'BASE TABLE'
  `;
  const present = new Set(rows.map((row) => String((row as { table_name: string }).table_name)));
  for (const table of REQUIRED_APPLICATION_TABLES) {
    if (!present.has(table)) {
      failures.push(`missing required application table: ${table}`);
    }
  }
  return failures;
}
