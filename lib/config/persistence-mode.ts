/**
 * Alpha persistence adapter gate.
 *
 * When disabled, report routes fail closed (503) — no silent in-memory fallback.
 * Supabase env here means "alpha adapter configured", not production backend choice.
 */

export function isPersistenceEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
