import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isServerSupabaseConfigured } from "@/lib/config/supabase-config";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  if (!isServerSupabaseConfigured()) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const code = searchParams.get("code");
  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(`${origin}/app/settings`);
}
