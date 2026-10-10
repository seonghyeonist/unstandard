import "server-only";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { identityProviderPurgeQueueRepository } from "@/lib/db/repositories/identity.repository";
import { canOperateSandboxPurges } from "@/lib/identity/operator-purge-policy";
import { reconcileIdentityProviderPurges } from "@/lib/identity/reconciliation";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";
import { getIdentityPurgeProvider } from "@/lib/server/identity/provider";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!canOperateSandboxPurges(process.env)) return privateJson({ error: "Not available" }, { status: 404 });
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  const provider = getIdentityPurgeProvider();
  if (!provider) return privateJson({ error: "Cleanup unavailable" }, { status: 503 });
  try {
    // No caller-supplied reference or binding. Read only the durable deletion outbox.
    const result = await reconcileIdentityProviderPurges({
      repository: identityProviderPurgeQueueRepository, provider, limit: 2,
    });
    console.info(JSON.stringify({ event: "identity.operator.purges", ...result }));
    return privateJson({ providerPurges: result });
  } catch {
    console.error(JSON.stringify({ event: "identity.operator.purges", code: "RETRY_REQUIRED" }));
    return privateJson({ error: "Cleanup unavailable; retry required" }, { status: 503 });
  }
}
