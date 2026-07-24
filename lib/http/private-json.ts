import { NextResponse } from "next/server";

/** Cache-Control contract for session / authorization-sensitive JSON. */
export const PRIVATE_NO_STORE_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate" as const;

export type PrivateJsonInit = {
  status?: number;
  headers?: HeadersInit;
};

/**
 * Append `Cookie` to Vary without destroying existing Vary tokens.
 */
export function withVaryCookie(headers: Headers): void {
  const existing = headers.get("Vary");
  if (!existing) {
    headers.set("Vary", "Cookie");
    return;
  }
  const tokens = existing
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const hasCookie = tokens.some((token) => token.toLowerCase() === "cookie");
  if (!hasCookie) {
    tokens.push("Cookie");
  }
  headers.set("Vary", tokens.join(", "));
}

/**
 * Apply private/no-store cache headers required for authenticated or
 * session-sensitive responses (including 401/4xx/5xx).
 */
export function applyPrivateNoStoreHeaders(headers: Headers): void {
  headers.set("Cache-Control", PRIVATE_NO_STORE_CACHE_CONTROL);
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  withVaryCookie(headers);
}

/**
 * JSON response with private, no-store cache semantics.
 * Use for every auth/session/authorization-sensitive route response.
 */
export function privateJson<T>(body: T, init: PrivateJsonInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  applyPrivateNoStoreHeaders(headers);
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers,
  });
}

/**
 * True when Cache-Control permits shared caches (forbidden for sessions).
 */
export function cacheControlAllowsPublic(cacheControl: string | null): boolean {
  if (!cacheControl) return false;
  return /\bpublic\b/i.test(cacheControl);
}

/**
 * Validate the private/no-store contract on a response Cache-Control header.
 */
export function assertPrivateNoStoreCacheControl(cacheControl: string | null): string[] {
  const failures: string[] = [];
  if (!cacheControl) {
    failures.push("missing Cache-Control");
    return failures;
  }
  if (!/\bprivate\b/i.test(cacheControl)) {
    failures.push("Cache-Control must contain private");
  }
  if (!/\bno-store\b/i.test(cacheControl)) {
    failures.push("Cache-Control must contain no-store");
  }
  if (cacheControlAllowsPublic(cacheControl)) {
    failures.push("Cache-Control must not contain public");
  }
  return failures;
}
