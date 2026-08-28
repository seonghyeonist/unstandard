import type { IdentityVerificationRequest, IdentityVerificationResponse } from "@portone/browser-sdk/v2";
import { IDENTITY_NOTICE_VERSION, identityLaunchSchema, identityRequestIdSchema } from "@/lib/identity/contracts";

type BrowserIdentitySdk = (request: IdentityVerificationRequest) => Promise<IdentityVerificationResponse | undefined>;
const failureMessage = "인증을 완료하지 못했어요. 취소·팝업 차단 여부를 확인하거나 잠시 뒤 결과 확인을 다시 눌러 주세요.";

async function identityPost(action: "start" | "complete", body: unknown, fetcher: typeof fetch) {
  const response = await fetcher(`/api/identity/${action}`, { method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status === 429 ? "인증 요청 한도에 도달했어요. 잠시 뒤 다시 시도해 주세요." : failureMessage);
  return response.json();
}

export async function completeBrowserIdentity(requestId: string, fetcher: typeof fetch = fetch) {
  if (!identityRequestIdSchema.safeParse(requestId).success) throw new Error(failureMessage);
  const result = await identityPost("complete", { requestId }, fetcher);
  if (result.ok !== true || result.requestId !== requestId) throw new Error(failureMessage);
}

/** Browser messages only trigger a canonical server lookup; they are never proof of identity. */
export async function startBrowserIdentity(input: {
  consentAccepted: boolean; origin: string; sdk: BrowserIdentitySdk; onStarted: (requestId: string) => void;
}, fetcher: typeof fetch = fetch) {
  if (!input.consentAccepted || new URL(input.origin).protocol !== "https:") throw new Error(failureMessage);
  const result = await identityPost("start", { consentAccepted: true, noticeVersion: IDENTITY_NOTICE_VERSION }, fetcher);
  const launch = identityLaunchSchema.safeParse(result.launch);
  if (result.ok !== true || !launch.success || launch.data.identityVerificationId !== result.requestId) throw new Error(failureMessage);
  const { storeId, channelKey, identityVerificationId } = launch.data;
  input.onStarted(identityVerificationId);
  let response: IdentityVerificationResponse | undefined;
  try {
    response = await input.sdk({ storeId, channelKey, identityVerificationId,
      redirectUrl: new URL("/api/identity/return", input.origin).toString(),
      // No customer, customData, name, phone, nickname, email or birth date leaves the app here.
      bypass: { danal: { CPTITLE: new URL("/profile-setup", input.origin).toString() } },
    });
  } catch { throw new Error(failureMessage); }
  if (!response) return; // Mobile redirect: own pending ID is recovered from the authenticated DB view.
  if (response.code || response.identityVerificationId !== identityVerificationId || response.transactionType !== "IDENTITY_VERIFICATION") {
    throw new Error(failureMessage);
  }
  await completeBrowserIdentity(identityVerificationId, fetcher);
}
