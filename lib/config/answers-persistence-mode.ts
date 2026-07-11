/**
 * Answers persistence activation gate (server-side).
 *
 * Supabase public env vars alone must NOT enable answers DB persistence.
 * Requires explicit ANSWERS_PERSISTENCE_ADAPTER=supabase-alpha plus adapter env.
 * When disabled, onboarding keeps mock/sessionStorage or staging bypass paths.
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

export type AnswersPersistenceAdapter = "disabled" | "supabase-alpha";

export function getAnswersPersistenceAdapter(): AnswersPersistenceAdapter {
  const value = process.env.ANSWERS_PERSISTENCE_ADAPTER;
  if (value === "supabase-alpha") {
    return "supabase-alpha";
  }
  return "disabled";
}

export function isAnswersPersistenceEnabled(): boolean {
  return getAnswersPersistenceAdapter() === "supabase-alpha" && isServerSupabaseConfigured();
}
