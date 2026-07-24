import { AuthError, getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { toPublicSessionUser } from "@/lib/auth/session-view";
import { privateJson } from "@/lib/http/private-json";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return privateJson({ user: null }, { status: 401 });
    }

    const publicUser = toPublicSessionUser(user);
    return privateJson({
      user: {
        nickname: publicUser.nickname,
        onboarded: publicUser.onboarded,
        idPrefix: publicUser.idPrefix,
      },
    });
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: error.message }, { status: 503 });
    }
    if (error instanceof AuthError) {
      return privateJson({ error: error.message }, { status: 401 });
    }
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
