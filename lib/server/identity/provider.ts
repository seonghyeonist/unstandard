import "server-only";
import type { IdentityProvider } from "@/lib/identity/contracts";
import { createPortOneIdentityProvider, parsePortOneIdentityConfig } from "@/lib/identity/portone";
import { IDENTITY_PROVIDER_NOTICE_READY } from "@/lib/identity/notice";

/** Deliberately closed until a provider, contract, retention notice and live flow are approved.
 * No env-only mock mode, manual-success endpoint, SMS fallback or automatic verified backfill.
 */
export function getIdentityProvider(): IdentityProvider | null {
  if (!IDENTITY_PROVIDER_NOTICE_READY) return null;
  const config = parsePortOneIdentityConfig(process.env);
  return config ? createPortOneIdentityProvider(config) : null;
}
