import "server-only";
import {
  getSocialProviderAvailabilityFromEnv,
  SOCIAL_PROVIDER_IDS,
  type SocialProviderAvailability,
  type SocialProviderId,
} from "@/lib/auth/social-config-policy";

export { SOCIAL_PROVIDER_IDS };
export type { SocialProviderAvailability, SocialProviderId };

/** Exposes availability only; provider credentials never cross the client boundary. */
export function getSocialProviderAvailability(
  env: Record<string, string | undefined> = process.env,
): SocialProviderAvailability {
  return getSocialProviderAvailabilityFromEnv(env);
}
