/**
 * DATABASE_ENV distinguishes writable database targets for safety guards.
 */

export type DatabaseEnv = "local" | "test" | "staging" | "production";

const VALID: DatabaseEnv[] = ["local", "test", "staging", "production"];

export function getDatabaseEnv(): DatabaseEnv | null {
  const value = process.env.DATABASE_ENV?.trim();
  if (!value) return null;
  if (VALID.includes(value as DatabaseEnv)) {
    return value as DatabaseEnv;
  }
  return null;
}

export function requireDatabaseEnv(): DatabaseEnv {
  const env = getDatabaseEnv();
  if (!env) {
    throw new Error("DATABASE_ENV must be set to local, test, staging, or production");
  }
  return env;
}

export function assertTestDatabaseEnv(): void {
  const env = requireDatabaseEnv();
  if (env !== "test") {
    throw new Error("Destructive tests require DATABASE_ENV=test");
  }
}

export function isProductionDatabaseUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("prod") ||
    lower.includes("production") ||
    process.env.DATABASE_ENV === "production"
  );
}
