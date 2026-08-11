/**
 * Server runtime mode — mock is dev-only; deployed environments must use database.
 */

export type RuntimeMode = "mock" | "database";

export function getRuntimeMode(): RuntimeMode {
  const explicit = process.env.UNSTANDARD_RUNTIME_MODE?.trim();
  if (explicit === "database") return "database";
  if (explicit === "mock") return "mock";

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) {
    return "database";
  }

  return "mock";
}

export function isDatabaseRuntime(): boolean {
  return getRuntimeMode() === "database";
}

export function isMockRuntime(): boolean {
  return getRuntimeMode() === "mock";
}

export function isMockAuthAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV) return false;
  return isMockRuntime();
}

export function isDatabaseAuthConfigured(): boolean {
  if (!isDatabaseRuntime()) return false;
  return Boolean(
    process.env.DATABASE_URL?.trim() &&
      process.env.BETTER_AUTH_SECRET?.trim() &&
      process.env.BETTER_AUTH_URL?.trim(),
  );
}
