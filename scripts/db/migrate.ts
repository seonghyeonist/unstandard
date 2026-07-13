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
  console.error(error instanceof Error ? error.message : "migrate failed");
  process.exit(1);
});
