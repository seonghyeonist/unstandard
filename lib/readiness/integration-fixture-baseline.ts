import { Pool } from "@neondatabase/serverless";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";

configureNeonWebSocket();

const FIXTURE_TABLES = ["users", "profiles", "alpha_invites"] as const;
const CONNECT_TIMEOUT_MS = 15_000;
const QUERY_TIMEOUT_MS = 20_000;
const CLOSE_TIMEOUT_MS = 5_000;
type FixtureTable = (typeof FIXTURE_TABLES)[number];

export type IntegrationFixtureBaseline = Record<FixtureTable, number>;

export function assertIntegrationFixtureBaselineRestored(
  before: IntegrationFixtureBaseline,
  after: IntegrationFixtureBaseline,
): void {
  const drift = FIXTURE_TABLES.flatMap((table) =>
    before[table] === after[table]
      ? []
      : [`${table} before=${before[table]} after=${after[table]}`],
  );
  if (drift.length > 0) {
    throw new Error(`fixture row counts changed: ${drift.join("; ")}`);
  }
}

export async function readIntegrationFixtureBaseline(
  databaseUrl: string,
): Promise<IntegrationFixtureBaseline> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  try {
    const existingResult = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'profiles', 'alpha_invites')
    `);
    const existing = new Set(existingResult.rows.map((row) => row.table_name));
    const counts: IntegrationFixtureBaseline = {
      users: 0,
      profiles: 0,
      alpha_invites: 0,
    };

    for (const table of FIXTURE_TABLES) {
      if (!existing.has(table)) continue;
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.${table}`,
      );
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  } finally {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        pool.end(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Object.assign(new Error("POOL_CLOSE_TIMEOUT"), { code: "POOL_CLOSE_TIMEOUT" })),
            CLOSE_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export async function proveIntegrationFixtureBaselineRestored(
  databaseUrl: string,
  before: IntegrationFixtureBaseline,
): Promise<void> {
  const after = await readIntegrationFixtureBaseline(databaseUrl);
  assertIntegrationFixtureBaselineRestored(before, after);
}
