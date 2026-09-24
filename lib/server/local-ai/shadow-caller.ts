import "server-only";

import { after } from "next/server";
import {
  getLocalAiShadowConfig,
  LOCAL_AI_SHADOW_TIMEOUT_MS,
  parseLocalAiShadowEvaluation,
} from "@/lib/server/local-ai/shadow-contract";
import { preserveAuthoritativeUnlock } from "@/lib/server/local-ai/shadow-invariant";
import { persistLocalAiShadowEvaluation } from "@/lib/server/local-ai/shadow-evaluation.repository";

type ScheduleShadowInput = {
  unlockAttemptId: string;
  questionText: string;
  answerText: string;
  authoritative: {
    verdict: string;
    unlocked: boolean;
    idempotent: boolean;
  };
};

function logFailure(code: "SCHEDULE_FAILED" | "OBSERVATION_FAILED"): void {
  try {
    console.warn("local_ai_shadow", { code });
  } catch {
    // Logging must not escape into authoritative request handling.
  }
}

export function scheduleLocalAiShadowEvaluation(input: ScheduleShadowInput): void {
  try {
    const config = getLocalAiShadowConfig(process.env);
    if (!config) return;

    after(() =>
      preserveAuthoritativeUnlock(
        input.authoritative,
        async () => {
          const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-unstandard-depth-service-token": config.serviceToken,
            },
            body: JSON.stringify({
              question_text: input.questionText,
              answer_text: input.answerText,
            }),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(LOCAL_AI_SHADOW_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error("SHADOW_HTTP_ERROR");
          const contentLength = Number(response.headers.get("content-length") ?? 0);
          if (Number.isFinite(contentLength) && contentLength > 32_768) {
            throw new Error("SHADOW_RESPONSE_TOO_LARGE");
          }

          let payload: unknown;
          try {
            const responseText = await response.text();
            if (responseText.length > 32_768) throw new Error("SHADOW_RESPONSE_TOO_LARGE");
            payload = JSON.parse(responseText) as unknown;
          } catch {
            throw new Error("SHADOW_MALFORMED_RESPONSE");
          }

          const evaluation = parseLocalAiShadowEvaluation(payload);
          await persistLocalAiShadowEvaluation(input.unlockAttemptId, evaluation);
        },
        () => logFailure("OBSERVATION_FAILED"),
      ),
    );
  } catch {
    logFailure("SCHEDULE_FAILED");
  }
}
