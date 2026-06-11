import { apiFetch, hasApiBaseUrl } from "@/lib/api/client";
import { onboardingQuestion } from "@/lib/api/mock-data";
import type { ApiVerdict, UnlockStatus } from "@/types/api";

type DepthEvaluateResponse = {
  verdict: "PASS" | "REVIEW" | "REJECT";
};

const unlockedProfiles = new Set<string>();
const verdicts = new Map<string, ApiVerdict>();

function mockVerdict(answer: string): ApiVerdict {
  const trimmed = answer.trim();
  if (trimmed.length < 18) return "REJECT";
  if (trimmed.length < 45 || !/[.?!。！？]|요|다|어요/.test(trimmed)) return "REVIEW";
  return "PASS";
}

export async function submitUnlockAnswer(profileId: string, answer: string): Promise<{ verdict: ApiVerdict }> {
  try {
    const verdict = hasApiBaseUrl()
      ? (
          await apiFetch<DepthEvaluateResponse>("/internal/depth/evaluate", {
            method: "POST",
            body: JSON.stringify({
              user_id: "11111111-1111-1111-1111-111111111111",
              question_id: onboardingQuestion.id,
              answer_id: crypto.randomUUID(),
              question_text: onboardingQuestion.prompt,
              answer_text: answer,
            }),
          })
        ).verdict
      : mockVerdict(answer);

    verdicts.set(profileId, verdict);
    if (verdict === "PASS") unlockedProfiles.add(profileId);
    return { verdict };
  } catch {
    verdicts.set(profileId, "ERROR");
    return { verdict: "ERROR" };
  }
}

export async function getUnlockStatus(profileId: string): Promise<UnlockStatus> {
  return {
    profileId,
    unlocked: unlockedProfiles.has(profileId),
    verdict: verdicts.get(profileId),
  };
}
