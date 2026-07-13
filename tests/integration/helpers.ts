import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { assertTestDatabaseEnv } from "@/lib/config/database-env";
import { requireDestructiveTestConfirmation, requireTestDatabaseUrl } from "@/lib/db/migration-guards";
import { schema } from "@/lib/db/schema";

export type IntegrationDb = NeonHttpDatabase<typeof schema>;

export function getIntegrationDatabaseUrl(): string {
  assertTestDatabaseEnv();
  requireDestructiveTestConfirmation();
  return requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

export function createIntegrationDb(url = getIntegrationDatabaseUrl()): IntegrationDb {
  if (process.env.DATABASE_ENV !== "test") {
    throw new Error("Integration database helper requires DATABASE_ENV=test");
  }

  const sql = neon(url);
  return drizzle(sql, { schema });
}

export async function assertDatabaseReachable(url: string): Promise<void> {
  const sql = neon(url);
  await sql`SELECT 1`;
}
