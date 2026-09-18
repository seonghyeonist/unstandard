import "server-only";
import type { IdentityProvider } from "@/lib/identity/contracts";
import { createDiditIdentityProvider, parseDiditIdentityConfig } from "@/lib/identity/didit";
import { IDENTITY_PROVIDER_NOTICE_READY } from "@/lib/identity/notice";
import { classifyIdentityReadiness, publicIdentityAvailabilityReason, type IdentityReadinessCode } from "@/lib/identity/readiness";
import { logIdentityEvent } from "@/lib/server/identity/identity-logger";

export type IdentityReadiness = {
  available: boolean;
  code: IdentityReadinessCode;
  publicReason: "not_ready" | "temporarily_unavailable" | null;
  provider: IdentityProvider | null;
};

function providerDiagnostic(event: { operation: "start" | "verify" | "purge"; code: string; status?: number }): void {
  logIdentityEvent({
    event: `identity.provider.${event.operation}`,
    stage: event.operation === "start" ? "start" : "complete",
    status: "error",
    code: event.code,
    providerStatus: event.status,
  });
}

/**
 * Returns a server-only readiness classification. The public reason is safe
 * for the setup page; the internal code stays in server logs.
 */
export function getIdentityReadiness(env: Record<string, string | undefined> = process.env): IdentityReadiness {
  const code = classifyIdentityReadiness(env, IDENTITY_PROVIDER_NOTICE_READY);
  const publicReason = publicIdentityAvailabilityReason(code);
  if (code !== "READY") {
    return { available: false, code, publicReason, provider: null };
  }
  const config = parseDiditIdentityConfig(env);
  if (!config) {
    return { available: false, code: "CONFIG_INCOMPLETE", publicReason: "temporarily_unavailable", provider: null };
  }
  return {
    available: true,
    code,
    publicReason,
    provider: createDiditIdentityProvider(config, fetch, undefined, providerDiagnostic),
  };
}

export function getIdentityProvider(): IdentityProvider | null {
  return getIdentityReadiness().provider;
}
