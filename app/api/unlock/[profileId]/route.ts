import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";

export async function GET(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { profileId } = await context.params;
  if (!profileId || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return NextResponse.json({ error: "Invalid profileId" }, { status: 400 });
  }

  const unlocked = await hasUnlockCookie(profileId, user.id);
  return NextResponse.json({ profileId, unlocked });
}
