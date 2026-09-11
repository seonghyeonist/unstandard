/**
 * OAuth state is stored in a host-only, signed cookie by Better Auth.  The
 * browser origin that starts OAuth must therefore be exactly the same origin
 * that Better Auth uses for its provider callback.
 */
export function normalizeWebOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !local) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * BETTER_AUTH_URL is Better Auth's redirect-uri authority.  Do not silently
 * select a different app origin: that creates a state cookie on one host and
 * sends the Google callback to another.
 */
export function getCanonicalAuthOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const authOrigin = normalizeWebOrigin(env.BETTER_AUTH_URL);
  const appOrigin = normalizeWebOrigin(env.UNSTANDARD_APP_URL);
  if (!authOrigin || !appOrigin) throw new Error("AUTH_CANONICAL_ORIGIN_UNAVAILABLE");
  if (authOrigin !== appOrigin) throw new Error("AUTH_CANONICAL_ORIGIN_MISMATCH");
  return authOrigin;
}

export function expectedOAuthStateCookieName(canonicalOrigin: string): string {
  return canonicalOrigin.startsWith("https://")
    ? "__Secure-better-auth.state"
    : "better-auth.state";
}

export function canonicalBrowserLocation(canonicalOrigin: string, location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${canonicalOrigin}${location.pathname}${location.search}${location.hash}`;
}
