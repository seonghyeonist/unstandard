import {
  getLocalAiShadowConfig,
  LOCAL_AI_SHADOW_TIMEOUT_MS,
  parseLocalAiShadowEvaluation,
  type LocalAiShadowEvaluation,
} from "@/lib/server/local-ai/shadow-contract";
import { preserveAuthoritativeUnlock } from "@/lib/server/local-ai/shadow-invariant";

const MAX_SHADOW_RESPONSE_BYTES = 32_768;

export type LocalAiShadowFailureCode = "SCHEDULE_FAILED" | "OBSERVATION_FAILED";

export type LocalAiShadowScheduleInput = {
  unlockAttemptId: string;
  questionText: string;
  answerText: string;
  authoritative: {
    verdict: string;
    unlocked: boolean;
    idempotent: boolean;
  };
};

export type LocalAiShadowFlowDependencies = {
  env: Record<string, string | undefined>;
  schedule: (callback: () => Promise<void>) => void;
  fetchImpl: typeof fetch;
  persistEvaluation: (
    unlockAttemptId: string,
    evaluation: LocalAiShadowEvaluation,
  ) => Promise<void>;
  logFailure: (code: LocalAiShadowFailureCode) => void;
};

function reportFailure(
  dependencies: LocalAiShadowFlowDependencies,
  code: LocalAiShadowFailureCode,
): void {
  try {
    dependencies.logFailure(code);
  } catch {
    // Logging failures must not escape into authoritative request handling.
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best effort: the caller still rejects the response.
  }
}

async function readResponseTextWithinLimit(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_SHADOW_RESPONSE_BYTES
  ) {
    await cancelResponseBody(response);
    throw new Error("SHADOW_RESPONSE_TOO_LARGE");
  }

  if (!response.body) throw new Error("SHADOW_MALFORMED_RESPONSE");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_SHADOW_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("SHADOW_RESPONSE_TOO_LARGE");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

export function scheduleLocalAiShadowFlow(
  input: LocalAiShadowScheduleInput,
  dependencies: LocalAiShadowFlowDependencies,
): void {
  try {
    const config = getLocalAiShadowConfig(dependencies.env);
    if (!config) return;

    dependencies.schedule(async () => {
      await preserveAuthoritativeUnlock(
        input.authoritative,
        async () => {
          const response = await dependencies.fetchImpl(config.endpoint, {
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
          if (!response.ok) {
            await cancelResponseBody(response);
            throw new Error("SHADOW_HTTP_ERROR");
          }

          const responseText = await readResponseTextWithinLimit(response);
          const evaluation = parseLocalAiShadowEvaluation(JSON.parse(responseText) as unknown);
          await dependencies.persistEvaluation(input.unlockAttemptId, evaluation);
        },
        () => reportFailure(dependencies, "OBSERVATION_FAILED"),
      );
    });
  } catch {
    reportFailure(dependencies, "SCHEDULE_FAILED");
  }
}
