import "server-only";

import { getDb } from "@/lib/db/client";
import { localAiShadowEvaluations } from "@/lib/db/schema/local-ai-shadow-evaluations";
import type { LocalAiShadowEvaluation } from "@/lib/server/local-ai/shadow-contract";

function numericValue(value: number | null): string | null {
  return value === null ? null : value.toFixed(4);
}

export async function persistLocalAiShadowEvaluation(
  unlockAttemptId: string,
  evaluation: LocalAiShadowEvaluation,
): Promise<void> {
  await getDb().insert(localAiShadowEvaluations).values({
    unlockAttemptId,
    depthScore: numericValue(evaluation.depthScore)!,
    verdict: evaluation.verdict,
    path: evaluation.path,
    reasonCodes: evaluation.reasonCodes,
    personalGroundingScore: numericValue(evaluation.features.personalGroundingScore),
    ungroundedAbstractPenalty: numericValue(evaluation.features.ungroundedAbstractPenalty),
    abstractStyleHits: evaluation.features.abstractStyleHits,
    relevanceScore: numericValue(evaluation.features.relevanceScore),
    specificityScore: numericValue(evaluation.features.specificityScore),
    repeatPatternPenalty: numericValue(evaluation.features.repeatPatternPenalty),
    emojiSymbolPenalty: numericValue(evaluation.features.emojiSymbolPenalty),
    spamSignaturePenalty: numericValue(evaluation.features.spamSignaturePenalty),
    modelVersion: evaluation.modelVersion,
    latencyMs: evaluation.latencyMs,
  });
}
