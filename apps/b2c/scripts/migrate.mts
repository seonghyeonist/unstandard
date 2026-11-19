import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connectDatabase, databaseTarget } from "../db/client.mts";

const {local} = databaseTarget();
const required = local ? "local-b2c" : "authorized-remote-b2c";
if (process.env.B2C_MIGRATE_CONFIRM !== required) {
  throw new Error("Explicit B2C_MIGRATE_CONFIRM is required for this target");
}

const {pool} = connectDatabase();
try {
  const client = await pool.connect();
  try {
    // All migration runners use this dedicated connection and the same lock.
    await client.query("select pg_advisory_lock(824098251)");
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL("../db/migrations/", import.meta.url)),
      migrationsSchema: "b2c_migration",
    });
    console.info("b2c_migration_complete");
  } finally {
    // End this client session so its advisory lock is released even on failure.
    client.release(true);
  }
} finally {
  await pool.end();
}
