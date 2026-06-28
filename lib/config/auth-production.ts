import { isSupabaseAuthEnabled } from "./auth-mode";

/**
 * Returns true when production is configured for real auth (Supabase env present).
 * Production without Supabase must fail closed — no mock, no silent pass-through.
 */
export function isProductionAuthConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return isSupabaseAuthEnabled();
}

export function assertProductionAuthConfigured(): void {
  if (!isProductionAuthConfigured()) {
    throw new Error(
      "Production requires UNSTANDARD_SUPABASE_URL and UNSTANDARD_SUPABASE_PUBLISHABLE_KEY",
    );
  }
}

export { isSupabaseAuthEnabled, isMockAuthAllowed } from "./auth-mode";
