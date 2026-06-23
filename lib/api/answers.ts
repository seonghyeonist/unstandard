import type { ApiVerdict, UnlockStatus } from "@/types/api";

export type UnlockAnswerResult = {
  verdict: ApiVerdict;
  reasonCodes: string[];
};

export async function submitUnlockAnswer(profileId: string, answer: string): Promise<UnlockAnswerResult> {
  const response = await fetch("/api/answers/unlock", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, answer }),
  });

  if (!response.ok) {
    return { verdict: "ERROR", reasonCodes: [] };
  }

  return response.json();
}

export async function getUnlockStatus(profileId: string): Promise<UnlockStatus> {
  const response = await fetch(`/api/unlock/${profileId}`, { credentials: "include" });
  if (!response.ok) {
    return { profileId, unlocked: false };
  }
  return response.json();
}
