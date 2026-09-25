import "server-only";

import { after } from "next/server";
import { persistLocalAiShadowEvaluation } from "@/lib/server/local-ai/shadow-evaluation.repository";
import {
  scheduleLocalAiShadowFlow,
  type LocalAiShadowFailureCode,
  type LocalAiShadowScheduleInput,
} from "@/lib/server/local-ai/shadow-flow";

function logFailure(code: LocalAiShadowFailureCode): void {
  try {
    console.warn("local_ai_shadow", { code });
  } catch {
    // Logging must not escape into authoritative request handling.
  }
}

export function scheduleLocalAiShadowEvaluation(input: LocalAiShadowScheduleInput): void {
  scheduleLocalAiShadowFlow(input, {
    env: process.env,
    schedule: (callback) => {
      after(callback);
    },
    fetchImpl: (request, init) => globalThis.fetch(request, init),
    persistEvaluation: persistLocalAiShadowEvaluation,
    logFailure,
  });
}
