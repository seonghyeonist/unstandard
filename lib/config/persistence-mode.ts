/**
 * Reports persistence activation gate (server-side).
 *
 * Supabase public env vars alone must NOT enable reports DB persistence.
 * Requires explicit REPORTS_PERSISTENCE_ADAPTER=supabase-alpha plus adapter env.
 * When disabled, report routes fail closed (503) — no silent in-memory fallback.
 */

export type ReportsPersistenceAdapter = "disabled" | "supabase-alpha";

export function getReportsPersistenceAdapter(): ReportsPersistenceAdapter {
  const value = process.env.REPORTS_PERSISTENCE_ADAPTER;
  if (value === "supabase-alpha") {
    return "supabase-alpha";
  }
  return "disabled";
}

export function isReportsPersistenceEnabled(): boolean {
  return (
    getReportsPersistenceAdapter() === "supabase-alpha" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
