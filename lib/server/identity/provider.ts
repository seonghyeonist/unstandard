import "server-only";
import type { IdentityProvider } from "@/lib/identity/contracts";
import { createDiditIdentityProvider, parseDiditIdentityConfig } from "@/lib/identity/didit";
import { IDENTITY_PROVIDER_NOTICE_READY } from "@/lib/identity/notice";

/** Deliberately closed until a provider, contract, retention notice and live flow are approved.
 * No env-only mock mode, manual-success endpoint, SMS fallback or automatic verified backfill.
 */
export function getIdentityProvider(): IdentityProvider | null {
  if (!IDENTITY_PROVIDER_NOTICE_READY) return null;
  const config = parseDiditIdentityConfig(process.env);
  return config ? createDiditIdentityProvider(config) : null;
}
