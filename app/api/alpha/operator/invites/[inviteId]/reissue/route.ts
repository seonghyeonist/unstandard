import { reissueStage1Invite, Stage1InviteError } from "@/lib/alpha/invite-admin";
import { buildInviteLink } from "@/lib/alpha/invite-link";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation } from "@/lib/http/profile-request";

export async function POST(request: Request, context: { params: Promise<{ inviteId: string }> }) {
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  const { inviteId } = await context.params;
  try {
    const created = await reissueStage1Invite(inviteId);
    return privateJson({
      invite: { id: created.inviteId, expiresAt: created.expiresAt, occupiedSeats: created.occupiedSeats },
      inviteLink: buildInviteLink(created.rawCode),
    });
  } catch (error) {
    const code = error instanceof Stage1InviteError ? error.code : "INVITE_UNAVAILABLE";
    return privateJson({ error: code }, { status: 409 });
  }
}
