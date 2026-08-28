import "server-only";
import type { IdentityProvider } from "@/lib/identity/contracts";

/** Deliberately closed until a provider, contract, retention notice and live flow are approved.
 * No env-only mock mode, manual-success endpoint, SMS fallback or automatic verified backfill.
 */
export function getIdentityProvider(): IdentityProvider | null {
  return null;
}
