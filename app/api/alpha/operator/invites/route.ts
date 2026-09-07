import {
  createStage1Invite,
  listStage1Invites,
  Stage1InviteError,
} from "@/lib/alpha/invite-admin";
import { buildInviteLink } from "@/lib/alpha/invite-link";
import { hasOperatorSession } from "@/lib/alpha/operator-auth";
import {
  ALPHA_BALANCE_CONSENT_VERSION,
  isAlphaAcquisitionChannel,
  isAlphaBalanceBucket,
  isAlphaRecruitmentCohort,
} from "@/lib/alpha/stage1-policy";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";

export async function GET() {
  if (!(await hasOperatorSession())) return privateJson({ error: "Unauthorized" }, { status: 403 });
  return privateJson({ invites: await listStage1Invites() });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request) || !(await hasOperatorSession())) {
    return privateJson({ error: "Unauthorized" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await readSmallJson(request, 2048);
  } catch {
    return privateJson({ error: "Invalid invite" }, { status: 422 });
  }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const email = String(input?.email ?? "").trim();
  const recruitmentCohort = String(input?.recruitmentCohort ?? "");
  const acquisitionChannel = String(input?.acquisitionChannel ?? "");
  const balanceBucket = String(input?.balanceBucket ?? "");
  const balanceConsent = input?.balanceConsent === true;
  if (!email.includes("@") || email.length > 254 ||
      !isAlphaRecruitmentCohort(recruitmentCohort) ||
      !isAlphaAcquisitionChannel(acquisitionChannel) ||
      !isAlphaBalanceBucket(balanceBucket) ||
      (balanceBucket === "not_counted" ? balanceConsent : !balanceConsent)) {
    return privateJson({ error: "Invalid invite" }, { status: 422 });
  }
  try {
    const created = await createStage1Invite({
      email,
      recruitmentCohort,
      acquisitionChannel,
      balanceBucket,
      balanceConsent: balanceBucket === "not_counted" ? null : {
        version: ALPHA_BALANCE_CONSENT_VERSION,
        consentedOn: new Date().toISOString().slice(0, 10),
      },
    });
    return privateJson({
      invite: {
        id: created.inviteId,
        expiresAt: created.expiresAt,
        occupiedSeats: created.occupiedSeats,
        balanceGate: created.balanceGate.gate,
      },
      // The one-time capability exists only in this operator response and the
      // fragment of the copied link. It is never persisted in local storage.
      inviteLink: buildInviteLink(created.rawCode, new URL(request.url).origin),
    });
  } catch (error) {
    const code = error instanceof Stage1InviteError ? error.code : "INVITE_UNAVAILABLE";
    return privateJson({ error: code }, { status: 409 });
  }
}
