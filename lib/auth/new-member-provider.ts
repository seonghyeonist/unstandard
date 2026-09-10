/**
 * Closed Alpha deliberately has one new-member authentication path. This is
 * distinct from the providers that existing members may still use to sign in.
 */
export const CLOSED_ALPHA_NEW_MEMBER_PROVIDER = "google" as const;

export function isClosedAlphaNewMemberProvider(
  provider: string | null | undefined,
): provider is typeof CLOSED_ALPHA_NEW_MEMBER_PROVIDER {
  return provider === CLOSED_ALPHA_NEW_MEMBER_PROVIDER;
}
