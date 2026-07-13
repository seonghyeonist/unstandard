import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/db/config";
import { schema } from "@/lib/db/schema";

export type AppDatabase = NeonHttpDatabase<typeof schema>;

let dbInstance: AppDatabase | null = null;

/**
 * Lazy database handle — never contacts Neon during build/import without DATABASE_URL.
 */
export function getDb(): AppDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }

  const sql = neon(url);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

export async function pingDatabase(): Promise<boolean> {
  const url = getDatabaseUrl();
  if (!url) return false;
  const sql = neon(url);
  await sql`SELECT 1`;
  return true;
}
