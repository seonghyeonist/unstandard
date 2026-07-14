import { getAuthenticatedUser } from "@/lib/auth/server";
import { privateJson } from "@/lib/http/private-json";
import { hasUnlockCookie } from "@/lib/server/unlock-cookies";

export async function GET(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { profileId } = await context.params;
  if (!profileId || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return privateJson({ error: "Invalid profileId" }, { status: 400 });
  }

  const unlocked = await hasUnlockCookie(profileId, user.id);
  return privateJson({ profileId, unlocked });
}
