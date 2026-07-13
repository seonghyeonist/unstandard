import { NextResponse, type NextRequest } from "next/server";
import { isProductionAuthConfigured } from "@/lib/config/auth-production";
import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";

const PROTECTED_PREFIXES = ["/app", "/onboarding"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Optimistic redirect only — real session validation happens in route handlers.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = isProtectedPath(pathname);

  if (protectedPath && !isProductionAuthConfigured()) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "auth_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  if (protectedPath && isDatabaseAuthConfigured()) {
    const hasSessionCookie = request.cookies
      .getAll()
      .some((cookie) => cookie.name.includes("session") || cookie.name.includes("better-auth"));
    if (!hasSessionCookie) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
};
