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

function normalizeVercelHost(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return normalizeWebOrigin(raw.includes("://") ? raw : `https://${raw}`);
}

function getVercelPreviewOrigin(env: Record<string, string | undefined>): string | null {
  if (env.VERCEL_ENV?.trim() !== "preview") return null;
  return normalizeVercelHost(env.VERCEL_BRANCH_URL) ?? normalizeVercelHost(env.VERCEL_URL);
}

export function getCanonicalAuthOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  // Direct credential auth keeps one canonical origin for cookies and links.
  const authOrigin = normalizeWebOrigin(env.BETTER_AUTH_URL);
  const appOrigin = normalizeWebOrigin(env.UNSTANDARD_APP_URL);

  if (authOrigin && appOrigin) {
    if (authOrigin !== appOrigin) throw new Error("AUTH_CANONICAL_ORIGIN_MISMATCH");
    return authOrigin;
  }

  // Preview deployments are branch-addressed and can be created before an
  // operator has provisioned branch-specific canonical URL variables. In that
  // narrow environment only, use Vercel's stable Git-branch URL (falling back
  // to the unique deployment URL) rather than making build/runtime auth crash.
  // Production remains strict and still requires the explicit canonical pair.
  const previewOrigin = getVercelPreviewOrigin(env);
  if (previewOrigin) return previewOrigin;

  throw new Error("AUTH_CANONICAL_ORIGIN_UNAVAILABLE");
}

export function canonicalBrowserLocation(canonicalOrigin: string, location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${canonicalOrigin}${location.pathname}${location.search}${location.hash}`;
}
