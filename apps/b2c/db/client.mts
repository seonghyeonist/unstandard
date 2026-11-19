import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.mts";

export function databaseTarget(env: NodeJS.ProcessEnv = process.env) {
  const value = env.B2C_DATABASE_URL;
  if (!value) throw new Error("B2C_DATABASE_URL is required");
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("Invalid B2C_DATABASE_URL");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      target.pathname !== "/unstandard_b2c" || target.search || target.hash) {
    throw new Error("Use the dedicated unstandard_b2c database with a plain PostgreSQL URI");
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname);
  if (!local && env.B2C_EXPECT_DB_HOST !== target.hostname) {
    throw new Error("Remote database host must exactly match B2C_EXPECT_DB_HOST");
  }
  return { value, local };
}

export function connectDatabase(env: NodeJS.ProcessEnv = process.env) {
  const { value, local } = databaseTarget(env);
  const pool = new pg.Pool({
    connectionString: value,
    ssl: local ? false : { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
  // Pool errors can contain connection metadata. Request handlers emit status codes only.
  pool.on("error", () => console.error("b2c_db_idle_connection_error"));
  return { pool, db: drizzle(pool, { schema }) };
}

export type Database = ReturnType<typeof connectDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
