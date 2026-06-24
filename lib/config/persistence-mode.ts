/**
 * Server-side persistence gate for alpha-safe storage.
 *
 * DB-backed reports are required for closed alpha — in-memory or sessionStorage
 * buffers are demo-only and must not be used as production source of truth.
 * When persistence is disabled, report routes fail closed (503), never silently
 * fall back to memory.
 */

export function isPersistenceEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
