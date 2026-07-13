import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { toPublicSessionUser } from "@/lib/auth/session-view";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const publicUser = toPublicSessionUser(user);
  return NextResponse.json({
    user: {
      nickname: publicUser.nickname,
      onboarded: publicUser.onboarded,
      idPrefix: publicUser.idPrefix,
    },
  });
}
