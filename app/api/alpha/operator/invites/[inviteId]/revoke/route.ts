import { revokeStage1Invite } from "@/lib/alpha/invite-admin";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";

export async function POST(request: Request, context: { params: Promise<{ inviteId: string }> }) {
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  const { inviteId } = await context.params;
  if (!(await revokeStage1Invite(inviteId))) return privateJson({ error: "Invite unavailable" }, { status: 409 });
  return privateJson({ ok: true });
}
