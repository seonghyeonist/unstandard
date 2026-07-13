import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { join } from "node:path";

export async function runDrizzleMigrations(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle/migrations") });
}
