import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { extractSafeAuthErrorFields } from "@/lib/auth/callback-diagnostics";
import { getSupabaseAuthRedirectOrigin } from "@/lib/auth/supabase-request-origin";
import { requireServerSupabaseConfig } from "@/lib/config/supabase-config";

export async function POST(request: NextRequest) {
  let email = "";

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { url, publishableKey } = requireServerSupabaseConfig();
  const origin = await getSupabaseAuthRedirectOrigin();

  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  console.info({
    action: "requestSupabaseMagicLink:start",
    redirectHost: new URL(`${origin}/auth/callback`).host,
    pkceCookieTransport: "route-response",
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const safeError = extractSafeAuthErrorFields(error);
    console.error({
      action: "requestSupabaseMagicLink",
      errorName: safeError.errorName,
      errorMessage: safeError.errorMessage,
      ...(safeError.errorStatus !== null ? { errorStatus: safeError.errorStatus } : {}),
      ...(safeError.errorCode !== null ? { errorCode: safeError.errorCode } : {}),
      redirectHost: new URL(`${origin}/auth/callback`).host,
      pkceCookieTransport: "route-response",
    });

    return NextResponse.json(
      { error: "Magic link request failed. Check Supabase email auth settings." },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  return response;
}
