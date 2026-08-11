import { isDatabaseRuntime } from "@/lib/config/runtime-mode";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Reports persistence is enabled when database runtime is active and DATABASE_URL is set.
 */
export function isReportsPersistenceEnabled(): boolean {
  return isDatabaseRuntime() && hasDatabaseUrl();
}

export function getReportsPersistenceAdapter(): "disabled" | "postgres" {
  return isReportsPersistenceEnabled() ? "postgres" : "disabled";
}
