import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  assertMigrateTargetAllowed,
  assertStagingMigrationEnv,
  requireDatabaseUrl,
  requireMigrateConfirmation,
} from "../../lib/db/migration-guards";
import { runDrizzleMigrations } from "../../lib/db/run-migrations";

async function main(): Promise<void> {
  const url = requireDatabaseUrl(process.env.DATABASE_URL);
  const env = assertStagingMigrationEnv();
  assertMigrateTargetAllowed(url, env);
  requireMigrateConfirmation();

  await runDrizzleMigrations(url);
  console.log("db:migrate complete");
}

main().catch((error) => {
  const code = (error as { code?: unknown } | null)?.code;
  const safeCode = typeof code === "string" && /^[A-Za-z0-9_-]{2,48}$/u.test(code)
    ? code
    : "MIGRATE_FAILED";
  console.error("db:migrate failed (" + safeCode + ")");
  process.exit(1);
});
