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

export function getCanonicalAuthOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  // Direct credential auth keeps one canonical origin for cookies and links.
  const authOrigin = normalizeWebOrigin(env.BETTER_AUTH_URL);
  const appOrigin = normalizeWebOrigin(env.UNSTANDARD_APP_URL);
  if (!authOrigin || !appOrigin) throw new Error("AUTH_CANONICAL_ORIGIN_UNAVAILABLE");
  if (authOrigin !== appOrigin) throw new Error("AUTH_CANONICAL_ORIGIN_MISMATCH");
  return authOrigin;
}

export function canonicalBrowserLocation(canonicalOrigin: string, location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${canonicalOrigin}${location.pathname}${location.search}${location.hash}`;
}
