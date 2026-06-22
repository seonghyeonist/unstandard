import { apiFetch, hasApiBaseUrl } from "@/lib/api/client";
import { candidates, onboardingQuestion } from "@/lib/api/mock-data";
import { evaluateDepthAnswer } from "@/lib/depth/evaluate-depth-answer";
import type { ApiVerdict, UnlockStatus } from "@/types/api";

type DepthEvaluateResponse = {
  verdict: "PASS" | "REVIEW" | "REJECT";
};

const unlockedProfiles = new Set<string>();
const verdicts = new Map<string, ApiVerdict>();

function questionForProfile(profileId: string): string {
  return candidates.find((candidate) => candidate.id === profileId)?.question ?? "";
}

export async function submitUnlockAnswer(profileId: string, answer: string): Promise<{ verdict: ApiVerdict }> {
  try {
    const verdict: ApiVerdict = hasApiBaseUrl()
      ? (
          await apiFetch<DepthEvaluateResponse>("/internal/depth/evaluate", {
            method: "POST",
            body: JSON.stringify({
              user_id: "11111111-1111-1111-1111-111111111111",
              question_id: onboardingQuestion.id,
              answer_id: crypto.randomUUID(),
              question_text: questionForProfile(profileId),
              answer_text: answer,
            }),
          })
        ).verdict
      : evaluateDepthAnswer({ questionText: questionForProfile(profileId), answerText: answer }).verdict;

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
