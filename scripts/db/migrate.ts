import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDatabaseEnv, isProductionDatabaseUrl } from "../../lib/config/database-env";

function requireMigrateConfirmation(): void {
  if (process.env.UNSTANDARD_CONFIRM_DB_MIGRATE !== "yes") {
    throw new Error("Set UNSTANDARD_CONFIRM_DB_MIGRATE=yes to run db:migrate");
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const env = getDatabaseEnv();
  if (!env) {
    throw new Error("DATABASE_ENV must be set");
  }

  if (isProductionDatabaseUrl(url) && env !== "production") {
    throw new Error("Refusing to migrate a production-looking DATABASE_URL without DATABASE_ENV=production");
  }

  requireMigrateConfirmation();

  const db = drizzle(neon(url));
  const dir = join(process.cwd(), "drizzle/migrations");
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
    console.log(`applied ${file}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "migrate failed");
  process.exit(1);
});
