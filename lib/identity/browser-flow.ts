import { IDENTITY_NOTICE_VERSION, identityLaunchSchema, identityRequestIdSchema } from "@/lib/identity/contracts";

const failureMessage = "인증을 완료하지 못했어요. 취소·팝업 차단 여부를 확인하거나 잠시 뒤 결과 확인을 다시 눌러 주세요.";

async function identityPost(action: "start" | "complete", body: unknown, fetcher: typeof fetch) {
  const response = await fetcher(`/api/identity/${action}`, { method: "POST", cache: "no-store",
    credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status === 429 ? "인증 요청 한도에 도달했어요. 잠시 뒤 다시 시도해 주세요." : failureMessage);
  return response.json();
}

export async function completeBrowserIdentity(requestId: string, fetcher: typeof fetch = fetch) {
  if (!identityRequestIdSchema.safeParse(requestId).success) throw new Error(failureMessage);
  const result = await identityPost("complete", { requestId }, fetcher);
  if (result.ok !== true || result.requestId !== requestId) throw new Error(failureMessage);
}

/** Browser callback state only navigates to Didit; the server later performs the canonical lookup. */
export async function startBrowserIdentity(input: {
  consentAccepted: boolean; origin: string; onStarted: (requestId: string) => void;
  navigate?: (url: string) => void;
}, fetcher: typeof fetch = fetch) {
  let origin: URL;
  try { origin = new URL(input.origin); } catch { throw new Error(failureMessage); }
  if (!input.consentAccepted || origin.protocol !== "https:" || origin.origin !== input.origin) throw new Error(failureMessage);
  const result = await identityPost("start", { consentAccepted: true, noticeVersion: IDENTITY_NOTICE_VERSION }, fetcher);
  const launch = identityLaunchSchema.safeParse(result.launch);
  if (result.ok !== true || !identityRequestIdSchema.safeParse(result.requestId).success || !launch.success) throw new Error(failureMessage);
  input.onStarted(result.requestId);
  const navigate = input.navigate ?? ((url: string) => window.location.assign(url));
  navigate(launch.data.url);
}
