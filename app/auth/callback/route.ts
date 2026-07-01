import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isServerSupabaseConfigured } from "@/lib/config/supabase-config";
import {
  extractSafeAuthErrorFields,
  getRedirectOriginHostLabel,
  getRequestHostInfo,
  hasAuthErrorInRequestUrl,
  safeAuthCallbackLog,
} from "@/lib/auth/callback-diagnostics";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const hostInfo = getRequestHostInfo(request);
  const hasCode = searchParams.has("code");

  safeAuthCallbackLog({
    action: "authCallback:start",
    requestHost: hostInfo.requestHost,
    forwardedHost: hostInfo.forwardedHost,
    forwardedProto: hostInfo.forwardedProto,
    hasCode,
    hasHashError: hasAuthErrorInRequestUrl(request.url),
    isServerSupabaseConfigured: isServerSupabaseConfigured(),
    redirectOriginHost: getRedirectOriginHostLabel(request),
  });

  if (!isServerSupabaseConfigured()) {
    safeAuthCallbackLog({
      action: "authCallback:missingConfig",
      requestHost: hostInfo.requestHost,
      hasCode,
      redirectTarget: "/login?error=auth_not_configured",
    });

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const code = searchParams.get("code");
  if (!code) {
    safeAuthCallbackLog({
      action: "authCallback:missingCode",
      requestHost: hostInfo.requestHost,
      hasCode: false,
      redirectTarget: "/login?error=auth_callback_failed",
    });

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const safeError = extractSafeAuthErrorFields(error);

    safeAuthCallbackLog({
      action: "authCallback:exchangeFailed",
      requestHost: hostInfo.requestHost,
      hasCode: true,
      errorName: safeError.errorName,
      errorMessage: safeError.errorMessage,
      errorStatus: safeError.errorStatus,
      errorCode: safeError.errorCode,
      redirectTarget: "/login?error=auth_callback_failed",
    });

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  safeAuthCallbackLog({
    action: "authCallback:exchangeSucceeded",
    requestHost: hostInfo.requestHost,
    hasCode: true,
    redirectTarget: "/app/settings",
  });

  return NextResponse.redirect(`${origin}/app/settings`);
}
