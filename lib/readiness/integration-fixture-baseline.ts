import { Pool } from "@neondatabase/serverless";
import { configureNeonWebSocket } from "@/lib/db/neon-websocket";

configureNeonWebSocket();

const FIXTURE_TABLES = ["users", "profiles", "alpha_invites"] as const;
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
  const pool = new Pool({ connectionString: databaseUrl });
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
    await pool.end();
  }
}

export async function proveIntegrationFixtureBaselineRestored(
  databaseUrl: string,
  before: IntegrationFixtureBaseline,
): Promise<void> {
  const after = await readIntegrationFixtureBaseline(databaseUrl);
  assertIntegrationFixtureBaselineRestored(before, after);
}
