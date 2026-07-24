import "server-only";

export function getDatabaseUrl(): string | null {
  const env = process.env.DATABASE_ENV?.trim();
  if (env === "test") {
    const testUrl = process.env.TEST_DATABASE_URL?.trim();
    if (!testUrl) return null;
    return testUrl;
  }

  const url = process.env.DATABASE_URL?.trim();
  return url || null;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    if (process.env.DATABASE_ENV === "test") {
      throw new Error("TEST_DATABASE_URL is not configured");
    }
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}
