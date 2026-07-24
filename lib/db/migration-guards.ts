import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  isProductionDatabaseUrl,
  requireDatabaseEnv,
  type DatabaseEnv,
} from "@/lib/config/database-env";

export class MigrationGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationGuardError";
  }
}

export function requireDatabaseUrl(url: string | undefined | null): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new MigrationGuardError("DATABASE_URL is required");
  }
  return trimmed;
}

export function requireTestDatabaseUrl(url: string | undefined | null): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new MigrationGuardError("TEST_DATABASE_URL is required");
  }
  if (isProductionDatabaseUrl(trimmed)) {
    throw new MigrationGuardError("TEST_DATABASE_URL must not target production");
  }
  return trimmed;
}

export function requireMigrateConfirmation(): void {
  if (process.env.UNSTANDARD_CONFIRM_DB_MIGRATE !== "yes") {
    throw new MigrationGuardError("Set UNSTANDARD_CONFIRM_DB_MIGRATE=yes to run db:migrate");
  }
}

export function requireDestructiveTestConfirmation(): void {
  if (process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST !== "yes") {
    throw new MigrationGuardError(
      "Set UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes to run destructive integration tests",
    );
  }
}

export function assertStagingMigrationEnv(): DatabaseEnv {
  const env = requireDatabaseEnv();
  if (env === "production") {
    throw new MigrationGuardError("Refusing migration when DATABASE_ENV=production");
  }
  return env;
}

export function assertMigrateTargetAllowed(url: string, env: DatabaseEnv): void {
  if (isProductionDatabaseUrl(url) && env !== "production") {
    throw new MigrationGuardError(
      "Refusing to migrate a production-looking DATABASE_URL without DATABASE_ENV=production",
    );
  }
}

export function listMigrationSqlFiles(migrationsDir = join(process.cwd(), "drizzle/migrations")): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function migrationSetChecksum(
  migrationsDir = join(process.cwd(), "drizzle/migrations"),
): string {
  const files = listMigrationSqlFiles(migrationsDir);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}
