/**
 * Reports persistence activation gate (server-side).
 *
 * Supabase public env vars alone must NOT enable reports DB persistence.
 * Requires explicit REPORTS_PERSISTENCE_ADAPTER=supabase-alpha plus adapter env.
 * When disabled, report routes fail closed (503) — no silent in-memory fallback.
 */

function isServerSupabaseConfigured(): boolean {
  const url =
    process.env.UNSTANDARD_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && publishableKey);
}

export type ReportsPersistenceAdapter = "disabled" | "supabase-alpha";

export function getReportsPersistenceAdapter(): ReportsPersistenceAdapter {
  const value = process.env.REPORTS_PERSISTENCE_ADAPTER;
  if (value === "supabase-alpha") {
    return "supabase-alpha";
  }
  return "disabled";
}

export function isReportsPersistenceEnabled(): boolean {
  return getReportsPersistenceAdapter() === "supabase-alpha" && isServerSupabaseConfigured();
}
