import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { identityProviderPurgeQueueRepository, identityRepository } from "@/lib/db/repositories/identity.repository";
import { reconcileIdentityCompletions, reconcileIdentityProviderPurges } from "@/lib/identity/reconciliation";
import { getIdentityPurgeProvider, getIdentityReadiness } from "@/lib/server/identity/provider";
import { createIdentityService } from "@/lib/server/identity/service";

function parseLimit(value: string | undefined): number {
  if (!value) return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) throw new Error("IDENTITY_RECONCILE_LIMIT must be an integer from 1 to 50");
  return parsed;
}

async function main(): Promise<void> {
  const provider = getIdentityPurgeProvider();
  if (!provider) {
    console.error("identity reconciliation unavailable: PURGE_PROVIDER_UNAVAILABLE");
    process.exitCode = 2;
    return;
  }

  const limit = parseLimit(process.env.IDENTITY_RECONCILE_LIMIT);
  const providerPurges = await reconcileIdentityProviderPurges({
    repository: identityProviderPurgeQueueRepository,
    provider,
    limit,
  });

  // Remote erasure can safely continue while new identity collection is
  // fail-closed. Canonical completion remains behind the full legal gate.
  const readiness = getIdentityReadiness();
  let completions = { selected: 0, verified: 0, retryable: 0, cleared: 0 };
  if (readiness.available) {
    completions = await reconcileIdentityCompletions({
      repository: identityRepository,
      service: createIdentityService(),
      limit,
    });
  }

  // Count-only output: no provider identifier, user identifier, decision, or secret.
  console.log(JSON.stringify({ identityReconciliation: completions, providerPurges }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "identity reconciliation failed");
  process.exit(1);
});
