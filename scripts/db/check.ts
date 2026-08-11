import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { pingDatabase } from "../../lib/db/client";

async function main(): Promise<void> {
  const ok = await pingDatabase();
  if (!ok) {
    throw new Error("Database connectivity check failed");
  }
  console.log("db:check PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db:check FAIL");
  process.exit(1);
});
