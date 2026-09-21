import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { identityRepository } from "@/lib/db/repositories/identity.repository";
import { reconcileIdentityCompletions } from "@/lib/identity/reconciliation";
import { getIdentityReadiness } from "@/lib/server/identity/provider";
import { createIdentityService } from "@/lib/server/identity/service";

function parseLimit(value: string | undefined): number {
  if (!value) return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) throw new Error("IDENTITY_RECONCILE_LIMIT must be an integer from 1 to 50");
  return parsed;
}

async function main(): Promise<void> {
  const readiness = getIdentityReadiness();
  if (!readiness.available) {
    console.error(`identity reconciliation unavailable: ${readiness.code}`);
    process.exitCode = 2;
    return;
  }
  const result = await reconcileIdentityCompletions({
    repository: identityRepository,
    service: createIdentityService(),
    limit: parseLimit(process.env.IDENTITY_RECONCILE_LIMIT),
  });
  // Count-only output: no provider identifier, user identifier, decision, or secret.
  console.log(JSON.stringify({ identityReconciliation: result }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "identity reconciliation failed");
  process.exit(1);
});
