import { NextResponse } from "next/server";
import { clearMockSessionUser } from "@/lib/auth/mock-session.server";
import { isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (isSupabaseAuthEnabled()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      return NextResponse.json({ error: "Logout failed" }, { status: 503 });
    }
  }

  await clearMockSessionUser();
  return NextResponse.json({ ok: true });
}
