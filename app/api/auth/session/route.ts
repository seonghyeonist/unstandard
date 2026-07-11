import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { toPublicSessionUser } from "@/lib/auth/session-view";
import { isSupabaseAuthEnabled } from "@/lib/config/auth-mode";
import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const publicUser = toPublicSessionUser(user, {
    supabaseAuth: isSupabaseAuthEnabled(),
    answersPersistenceEnabled: isAnswersPersistenceEnabled(),
  });
  return NextResponse.json({
    user: {
      nickname: publicUser.nickname,
      onboarded: publicUser.onboarded,
      idPrefix: publicUser.idPrefix,
    },
  });
}
