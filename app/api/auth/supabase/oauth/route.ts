import { NextResponse } from "next/server";
import type { Provider } from "@supabase/supabase-js";
import { resolveOAuthProvider } from "@/lib/auth/supabase-oauth";
import { getSupabaseAuthRedirectOrigin } from "@/lib/auth/supabase-request-origin";
import { createClient } from "@/lib/supabase/server";
import {
  getSupabaseOAuthProvider,
  isServerSupabaseConfigured,
} from "@/lib/config/supabase-config";

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const provider = resolveOAuthProvider(
    searchParams.get("provider"),
    getSupabaseOAuthProvider(),
  );
  if (!provider) {
    return NextResponse.json({ error: "OAuth provider is not configured" }, { status: 400 });
  }

  const redirectOrigin = await getSupabaseAuthRedirectOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: { redirectTo: `${redirectOrigin}/auth/callback` },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: "OAuth sign-in unavailable" }, { status: 503 });
  }

  return NextResponse.redirect(data.url);
}
