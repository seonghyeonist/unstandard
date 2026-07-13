import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { toPublicSessionUser } from "@/lib/auth/session-view";

export async function GET() {
  try {
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
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
