import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";

const CONNECT_TIMEOUT_MS = 15_000;
const QUERY_TIMEOUT_MS = 20_000;
const POOL_CLOSE_TIMEOUT_MS = 5_000;

function logBoundary(
  boundary: string,
  phase: "start" | "end",
  details: Record<string, string | number | boolean | null> = {},
): void {
  console.info(JSON.stringify({ event: "integration.database", boundary, phase, ...details }));
}

function safeErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,32}$/u.test(code)
    ? code
    : "UNKNOWN";
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error(timeoutCode), { code: timeoutCode }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Verify that a disposable PostgreSQL integration database is reachable.
 *
 * This lives outside tests/ so production type-checking and Vercel builds do
 * not depend on the test-only integration helper being present in the deploy
 * file set.
 */
export async function assertDatabaseReachable(databaseUrl: string): Promise<void> {
  const startedAt = Date.now();
  logBoundary("reachability", "start");
  configureNeonWebSocket();
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  let client: PoolClient | undefined;
  let transactionOpen = false;
  let passed = false;
  let primaryError: unknown;
  let activeBoundary = "first_select";
  try {
    logBoundary("first_select", "start", { transport: "pool_query_fetch" });
    await withTimeout(
      pool.query("SELECT 1"),
      QUERY_TIMEOUT_MS + 1_000,
      "FIRST_SELECT_TIMEOUT",
    );
    logBoundary("first_select", "end", { outcome: "PASS" });

    activeBoundary = "transaction_connect";
    client = await withTimeout(
      pool.connect(),
      CONNECT_TIMEOUT_MS + 1_000,
      "TRANSACTION_CONNECT_TIMEOUT",
    );
    activeBoundary = "first_transaction_begin";
    logBoundary("first_transaction_begin", "start", { transport: "pool_client" });
    await withTimeout(
      client.query("BEGIN"),
      QUERY_TIMEOUT_MS + 1_000,
      "TRANSACTION_BEGIN_TIMEOUT",
    );
    transactionOpen = true;
    logBoundary("first_transaction_begin", "end", { outcome: "PASS" });

    activeBoundary = "transaction_select";
    await withTimeout(
      client.query("SELECT 1"),
      QUERY_TIMEOUT_MS + 1_000,
      "TRANSACTION_SELECT_TIMEOUT",
    );
    activeBoundary = "first_transaction_commit";
    logBoundary("first_transaction_commit", "start");
    await withTimeout(
      client.query("COMMIT"),
      QUERY_TIMEOUT_MS + 1_000,
      "TRANSACTION_COMMIT_TIMEOUT",
    );
    transactionOpen = false;
    logBoundary("first_transaction_commit", "end", { outcome: "PASS" });
    passed = true;
    activeBoundary = "complete";
  } catch (error) {
    primaryError = error;
    const errorCode = safeErrorCode(error);
    if (activeBoundary !== "complete") {
      logBoundary(activeBoundary, "end", { outcome: "FAIL", error_code: errorCode });
    }
    logBoundary("reachability", "end", {
      outcome: "FAIL",
      elapsed_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
    throw Object.assign(new Error("database preflight failed (" + errorCode + ")"), {
      code: errorCode,
    });
  } finally {
    if (client) {
      if (transactionOpen) {
        try {
          await withTimeout(
            client.query("ROLLBACK"),
            QUERY_TIMEOUT_MS + 1_000,
            "TRANSACTION_ROLLBACK_TIMEOUT",
          );
        } catch {
          // The test branch is disposable; the hard suite/supervisor timeout remains the last bound.
        }
      }
      client.release(!passed);
    }
    logBoundary("pool_close", "start");
    try {
      await withTimeout(pool.end(), POOL_CLOSE_TIMEOUT_MS, "POOL_CLOSE_TIMEOUT");
      logBoundary("pool_close", "end", { outcome: "PASS" });
    } catch (error) {
      logBoundary("pool_close", "end", {
        outcome: "FAIL",
        error_code: safeErrorCode(error),
      });
      if (!primaryError) {
        throw new Error("database pool cleanup failed (POOL_CLOSE_TIMEOUT)");
      }
    }
    if (passed) {
      logBoundary("reachability", "end", {
        outcome: "PASS",
        elapsed_ms: Date.now() - startedAt,
        transaction_probe: true,
      });
    }
  }
}
