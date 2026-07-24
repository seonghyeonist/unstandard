import { isDatabaseRuntime } from "@/lib/config/runtime-mode";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Answers persistence is enabled when database runtime is active and DATABASE_URL is set.
 */
export function isAnswersPersistenceEnabled(): boolean {
  return isDatabaseRuntime() && hasDatabaseUrl();
}

export function getAnswersPersistenceAdapter(): "disabled" | "postgres" {
  return isAnswersPersistenceEnabled() ? "postgres" : "disabled";
}
