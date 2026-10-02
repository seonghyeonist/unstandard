import "server-only";
import { identityService } from "@/lib/identity/service";
import { identityProviderPurgeQueueRepository, identityRepository } from "@/lib/db/repositories/identity.repository";
import { getIdentityProvider } from "@/lib/server/identity/provider";
import { logIdentityEvent } from "@/lib/server/identity/identity-logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
export function createIdentityService() {
  return identityService({ provider: getIdentityProvider(), repository: identityRepository,
    purgeQueue: identityProviderPurgeQueueRepository,
    limit: async (scope, subject) => (await consumeRateLimit({ scope, subject })).allowed,
    log: logIdentityEvent,
  });
}
