import "server-only";
import { identityService } from "@/lib/identity/service";
import { identityRepository } from "@/lib/db/repositories/identity.repository";
import { getIdentityProvider } from "@/lib/server/identity/provider";
import { consumeRateLimit } from "@/lib/security/rate-limit";
export function createIdentityService() {
  return identityService({ provider: getIdentityProvider(), repository: identityRepository,
    limit: async (scope, subject) => (await consumeRateLimit({ scope, subject })).allowed });
}
