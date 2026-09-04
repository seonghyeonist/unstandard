export const SOCIAL_PROVIDER_IDS = ["google", "naver"] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];
export type SocialProviderAvailability = Record<SocialProviderId, boolean>;

function usableSecret(value: string | undefined): boolean {
  return Boolean(value?.trim() && !/[\r\n]/.test(value));
}

/** Pure availability policy; it returns booleans and never exposes credentials. */
export function getSocialProviderAvailabilityFromEnv(
  env: Record<string, string | undefined>,
): SocialProviderAvailability {
  return {
    google: usableSecret(env.GOOGLE_CLIENT_ID) && usableSecret(env.GOOGLE_CLIENT_SECRET),
    naver: usableSecret(env.NAVER_CLIENT_ID) && usableSecret(env.NAVER_CLIENT_SECRET),
  };
}
