import type { ApiVerdict, UnlockStatus } from "@/types/api";

export type UnlockAnswerResult = {
  verdict: ApiVerdict;
  reasonCodes: string[];
  code?: string;
  status?: number;
  correlationId?: string;
  unlocked?: boolean;
  idempotent?: boolean;
  message?: string;
  kind: "ok" | "http_error" | "network_error";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function submitUnlockAnswer(profileId: string, answer: string): Promise<UnlockAnswerResult> {
  let response: Response;
  try {
    response = await fetch("/api/answers/unlock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, answer }),
    });
  } catch {
    return {
      verdict: "ERROR",
      reasonCodes: [],
      kind: "network_error",
      code: "NETWORK_ERROR",
      message: "네트워크가 잠시 흔들렸어요. 같은 답을 한 번만 더 보내볼까요?",
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const record = asRecord(body);
  const verdict =
    record.verdict === "PASS" ||
    record.verdict === "REVIEW" ||
    record.verdict === "REJECT" ||
    record.verdict === "ERROR"
      ? record.verdict
      : response.ok
        ? "ERROR"
        : "ERROR";
  const reasonCodes = Array.isArray(record.reasonCodes)
    ? record.reasonCodes.filter((item): item is string => typeof item === "string")
    : [];

  if (!response.ok) {
    return {
      verdict: "ERROR",
      reasonCodes,
      kind: "http_error",
      status: response.status,
      code: typeof record.code === "string" ? record.code : `HTTP_${response.status}`,
      correlationId: typeof record.correlationId === "string" ? record.correlationId : undefined,
      message: typeof record.error === "string" ? record.error : undefined,
    };
  }

  return {
    verdict,
    reasonCodes,
    kind: "ok",
    status: response.status,
    code: typeof record.code === "string" ? record.code : undefined,
    correlationId: typeof record.correlationId === "string" ? record.correlationId : undefined,
    unlocked: Boolean(record.unlocked),
    idempotent: Boolean(record.idempotent),
  };
}

export async function getUnlockStatus(profileId: string): Promise<UnlockStatus> {
  try {
    const response = await fetch(`/api/unlock/${profileId}`, { credentials: "include" });
    if (!response.ok) {
      return { profileId, unlocked: false };
    }
    return response.json();
  } catch {
    return { profileId, unlocked: false };
  }
}
