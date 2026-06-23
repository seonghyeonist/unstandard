import { getCurrentUser } from "@/lib/api/auth";
import { apiFetch, hasApiBaseUrl } from "@/lib/api/client";
import { candidates, onboardingQuestion } from "@/lib/api/mock-data";
import { evaluateDepthAnswer } from "@/lib/depth/evaluate-depth-answer";
import type { ApiVerdict, UnlockStatus } from "@/types/api";

type DepthEvaluateResponse = {
  verdict: "PASS" | "REVIEW" | "REJECT";
  reason_codes?: string[];
};

export type UnlockAnswerResult = {
  verdict: ApiVerdict;
  reasonCodes: string[];
};

const unlockedProfiles = new Set<string>();
const verdicts = new Map<string, ApiVerdict>();

function questionForProfile(profileId: string): string {
  return candidates.find((candidate) => candidate.id === profileId)?.question ?? "";
}

export async function submitUnlockAnswer(profileId: string, answer: string): Promise<UnlockAnswerResult> {
  try {
    const user = await getCurrentUser();
    let verdict: ApiVerdict;
    let reasonCodes: string[];

    if (hasApiBaseUrl()) {
      const response = await apiFetch<DepthEvaluateResponse>("/internal/depth/evaluate", {
        method: "POST",
        body: JSON.stringify({
          user_id: user?.id ?? "anonymous-mock-user",
          question_id: onboardingQuestion.id,
          answer_id: crypto.randomUUID(),
          question_text: questionForProfile(profileId),
          answer_text: answer,
        }),
      });
      verdict = response.verdict;
      reasonCodes = response.reason_codes ?? [];
    } else {
      const evaluation = evaluateDepthAnswer({ questionText: questionForProfile(profileId), answerText: answer });
      verdict = evaluation.verdict;
      reasonCodes = evaluation.reasonCodes;
    }

    verdicts.set(profileId, verdict);
    if (verdict === "PASS") unlockedProfiles.add(profileId);
    return { verdict, reasonCodes };
  } catch {
    verdicts.set(profileId, "ERROR");
    return { verdict: "ERROR", reasonCodes: [] };
  }
}

export async function getUnlockStatus(profileId: string): Promise<UnlockStatus> {
  return {
    profileId,
    unlocked: unlockedProfiles.has(profileId),
    verdict: verdicts.get(profileId),
  };
}
