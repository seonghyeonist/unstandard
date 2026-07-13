import "server-only";

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url || null;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}
