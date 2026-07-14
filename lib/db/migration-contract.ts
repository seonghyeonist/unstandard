import { join } from "node:path";
import type { MigrationConfig } from "drizzle-orm/migrator";

/**
 * Shared migrator ledger location for runDrizzleMigrations and integration proofs.
 * Must match drizzle-orm neon-http migrator defaults when left unset:
 * migrationsSchema="drizzle", migrationsTable="__drizzle_migrations".
 * We set them explicitly so tests never hardcode independently.
 */
export const DRIZZLE_MIGRATIONS_SCHEMA = "drizzle" as const;
export const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations" as const;

export const APPLICATION_SCHEMA = "public" as const;

/** Tables the closed-alpha relational surface expects after migrations. */
export const REQUIRED_APPLICATION_TABLES = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "profiles",
  "profile_private",
  "questions",
  "answers",
  "depth_evaluations",
  "reports",
  "blocks",
  "unlocks",
  "alpha_invites",
  "app_config",
] as const;

export function getDrizzleMigrationsFolder(cwd = process.cwd()): string {
  return join(cwd, "drizzle/migrations");
}

export function getDrizzleMigrationConfig(cwd = process.cwd()): MigrationConfig {
  return {
    migrationsFolder: getDrizzleMigrationsFolder(cwd),
    migrationsSchema: DRIZZLE_MIGRATIONS_SCHEMA,
    migrationsTable: DRIZZLE_MIGRATIONS_TABLE,
  };
}

export type MigrationLedgerRow = {
  id: number;
  hash: string;
  created_at: string;
};

export function normalizeMigrationLedger(rows: MigrationLedgerRow[]): string {
  const normalized = [...rows]
    .map((row) => ({
      id: Number(row.id),
      hash: String(row.hash),
      created_at: String(row.created_at),
    }))
    .sort((a, b) => a.id - b.id);
  return JSON.stringify(normalized);
}

export function compareMigrationLedgers(
  before: MigrationLedgerRow[],
  after: MigrationLedgerRow[],
): string[] {
  const failures: string[] = [];
  if (before.length === 0) {
    failures.push("migration ledger is empty before second run");
  }
  if (after.length !== before.length) {
    failures.push(
      `migration ledger row count changed: before=${before.length} after=${after.length}`,
    );
  }
  const beforeNorm = normalizeMigrationLedger(before);
  const afterNorm = normalizeMigrationLedger(after);
  if (beforeNorm !== afterNorm) {
    failures.push("migration ledger entries changed after second run");
  }
  return failures;
}
