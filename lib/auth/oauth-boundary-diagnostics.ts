import {
  expectedOAuthStateCookieName,
  getCanonicalAuthOrigin,
  normalizeWebOrigin,
} from "@/lib/auth/canonical-origin";

type SafeCookieAttributes = {
  name: string;
  domain: string | null;
  path: string | null;
  sameSite: string | null;
  secure: boolean;
  httpOnly: boolean;
};

function hostOnly(value: string | undefined): string | null {
  return normalizeWebOrigin(value)?.replace(/^https?:\/\//, "") ?? null;
}

function cookieNames(header: string | null): Set<string> {
  return new Set((header ?? "").split(";").map((part) => part.trim().split("=", 1)[0]).filter(Boolean));
}

/** Never return cookie values. */
export function sanitizeSetCookie(setCookie: string): SafeCookieAttributes | null {
  const [first, ...parts] = setCookie.split(";");
  const name = first?.trim().split("=", 1)[0];
  if (!name) return null;
  const attributes = new Map<string, string | true>();
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    attributes.set(rawKey.toLowerCase(), rawValue.join("=") || true);
  }
  const stringAttribute = (name: string): string | null => {
    const value = attributes.get(name);
    return typeof value === "string" ? value : null;
  };
  return {
    name,
    domain: stringAttribute("domain"),
    path: stringAttribute("path"),
    sameSite: stringAttribute("samesite"),
    secure: attributes.has("secure"),
    httpOnly: attributes.has("httponly"),
  };
}

function responseSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values?.length) return values;
  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

export function getOAuthRequestDiagnostics(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  const pathname = new URL(request.url).pathname;
  const canonicalOrigin = getCanonicalAuthOrigin(env);
  const stateCookieName = expectedOAuthStateCookieName(canonicalOrigin);
  return {
    pathname,
    requestHost: new URL(request.url).host,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    betterAuthHost: hostOnly(env.BETTER_AUTH_URL),
    appHost: hostOnly(env.UNSTANDARD_APP_URL),
    branchHost: hostOnly(env.VERCEL_BRANCH_URL),
    deploymentHost: hostOnly(env.VERCEL_URL),
    stateCookieName,
    stateCookiePresent: cookieNames(request.headers.get("cookie")).has(stateCookieName),
    deploymentSha: env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
  };
}

export function getOAuthResponseDiagnostics(response: Response): SafeCookieAttributes[] {
  return responseSetCookies(response)
    .map(sanitizeSetCookie)
    .filter((cookie): cookie is SafeCookieAttributes => cookie !== null);
}

export function isOAuthBoundaryPath(pathname: string): boolean {
  return pathname === "/api/auth/sign-in/social" || /^\/api\/auth\/callback\/(google|naver)$/.test(pathname);
}
