import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/neon-http";
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
  schemaContentDigest,
  canonicalizeSchemaSnapshot,
  schemaSnapshotJson,
} from "./schema-snapshot";

export async function runDrizzleMigrations(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  const db = drizzle(sql);
  await migrate(db, getDrizzleMigrationConfig());
}

export async function readMigrationLedger(databaseUrl: string): Promise<MigrationLedgerRow[]> {
  const sql = neon(databaseUrl);
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
  const sql = neon(databaseUrl);
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
