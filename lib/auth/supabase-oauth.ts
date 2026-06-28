export const ALLOWED_OAUTH_PROVIDERS = new Set(["github", "google", "apple", "discord"]);

export function resolveOAuthProvider(
  requested?: string | null,
  configured?: string,
): string | null {
  const provider = requested?.trim() ?? configured?.trim();
  if (!provider || !ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    return null;
  }
  return provider;
}
