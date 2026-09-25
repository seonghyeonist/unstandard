import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocalAiShadowConfig,
  LOCAL_AI_SHADOW_MODEL_VERSION,
  parseLocalAiShadowEvaluation,
} from "@/lib/server/local-ai/shadow-contract";
import { preserveAuthoritativeUnlock } from "@/lib/server/local-ai/shadow-invariant";
import {
  scheduleLocalAiShadowFlow,
  type LocalAiShadowScheduleInput,
} from "@/lib/server/local-ai/shadow-flow";

test("Local AI shadow configuration is explicitly disabled by default", () => {
  assert.equal(getLocalAiShadowConfig({}), null);
  assert.equal(
    getLocalAiShadowConfig({
      UNSTANDARD_LOCAL_AI_SHADOW_ENABLED: "false",
      UNSTANDARD_LOCAL_AI_SHADOW_URL: "https://shadow.example.com/internal/depth/shadow-evaluate",
      UNSTANDARD_LOCAL_AI_SHADOW_TOKEN: "test-only-token",
    }),
    null,
  );
  assert.equal(
    getLocalAiShadowConfig({
      UNSTANDARD_LOCAL_AI_SHADOW_ENABLED: "true",
      UNSTANDARD_LOCAL_AI_SHADOW_URL: "https://shadow.example.com/internal/depth/shadow-evaluate?token=unsafe",
      UNSTANDARD_LOCAL_AI_SHADOW_TOKEN: "test-only-token",
    }),
    null,
  );
  assert.equal(
    getLocalAiShadowConfig({
      UNSTANDARD_LOCAL_AI_SHADOW_ENABLED: "true",
      UNSTANDARD_LOCAL_AI_SHADOW_URL: "https://shadow.example.com/internal/depth/shadow-evaluate",
      UNSTANDARD_LOCAL_AI_SHADOW_TOKEN: "test-only-token",
    })?.endpoint,
    "https://shadow.example.com/internal/depth/shadow-evaluate",
  );
  assert.equal(
    getLocalAiShadowConfig({
      UNSTANDARD_LOCAL_AI_SHADOW_ENABLED: "true",
      UNSTANDARD_LOCAL_AI_SHADOW_URL: "http://shadow.example.com/internal/depth/shadow-evaluate",
      UNSTANDARD_LOCAL_AI_SHADOW_TOKEN: "test-only-token",
    }),
    null,
  );
});

test("shadow response parser keeps only allowlisted aggregate fields", () => {
  const parsed = parseLocalAiShadowEvaluation({
    depth_score: 0.37,
    verdict: "REVIEW",
    path: "GRAY_BAND",
    reason_codes: ["UNGROUNDED_ABSTRACT_REVIEW"],
    model_version: LOCAL_AI_SHADOW_MODEL_VERSION,
    latency_ms: 210,
    features: {
      personal_grounding_score: 0.22,
      ungrounded_abstract_penalty: 0.51,
      abstract_style_hits: 3,
      relevance_score: 0.8,
      specificity_score: 0.3,
      repeat_pattern_penalty: 0,
      emoji_symbol_penalty: 0,
      spam_signature_penalty: 0.1,
      answer_length: 92,
    },
  });

  assert.equal(parsed.depthScore, 0.37);
  assert.equal(parsed.modelVersion, LOCAL_AI_SHADOW_MODEL_VERSION);
  assert.deepEqual(parsed.features, {
    personalGroundingScore: 0.22,
    ungroundedAbstractPenalty: 0.51,
    abstractStyleHits: 3,
    relevanceScore: 0.8,
    specificityScore: 0.3,
    repeatPatternPenalty: 0,
    emojiSymbolPenalty: 0,
    spamSignaturePenalty: 0.1,
  });
});

test("shadow parser rejects invalid output without returning payload details", () => {
  assert.throws(
    () => parseLocalAiShadowEvaluation({ verdict: "PASS" }),
    (error: unknown) => error instanceof Error && error.message === "MALFORMED_RESPONSE",
  );
  assert.throws(
    () =>
      parseLocalAiShadowEvaluation({
        depth_score: 0.3,
        verdict: "PASS",
        path: "BASIC",
        reason_codes: [],
        model_version: "unexpected-model",
        latency_ms: 5,
        features: {},
      }),
    (error: unknown) => error instanceof Error && error.message === "MODEL_VERSION_MISMATCH",
  );
  assert.throws(
    () =>
      parseLocalAiShadowEvaluation({
        depth_score: 1.5,
        verdict: "PASS",
        path: "BASIC",
        reason_codes: [],
        model_version: LOCAL_AI_SHADOW_MODEL_VERSION,
        latency_ms: 5,
        features: {},
      }),
    (error: unknown) => error instanceof Error && error.message === "MALFORMED_RESPONSE",
  );
  assert.throws(
    () =>
      parseLocalAiShadowEvaluation({
        depth_score: 0.3,
        verdict: "PASS",
        path: "BASIC",
        reason_codes: [],
        model_version: LOCAL_AI_SHADOW_MODEL_VERSION,
        latency_ms: 5,
        answer_text: "Unexpected raw text field",
        features: {},
      }),
    (error: unknown) => error instanceof Error && error.message === "MALFORMED_RESPONSE",
  );
});

test("mock-authoritative unlock result survives every shadow outcome", async () => {
  const authorities = [
    { verdict: "PASS", unlocked: true, reasonCodes: ["PASS_THRESHOLD"] },
    { verdict: "REVIEW", unlocked: false, reasonCodes: ["GRAY_BAND"] },
    { verdict: "REJECT", unlocked: false, reasonCodes: ["SPAM_REJECT"] },
  ];
  const outcomes: Array<() => Promise<unknown>> = [
    async () => ({ verdict: "PASS" }),
    async () => ({ verdict: "REVIEW" }),
    async () => ({ verdict: "REJECT" }),
    async () => {
      throw new Error("timeout");
    },
    async () => {
      throw new Error("HTTP 500");
    },
    async () => {
      throw new Error("malformed response");
    },
    async () => {
      throw new Error("network error");
    },
  ];

  for (const authoritative of authorities) {
    for (const outcome of outcomes) {
      assert.deepEqual(await preserveAuthoritativeUnlock(authoritative, outcome), authoritative);
    }
    let logged = false;
    assert.deepEqual(
      await preserveAuthoritativeUnlock(authoritative, async () => {
        throw new Error("timeout");
      }, () => {
        logged = true;
      }),
      authoritative,
    );
    assert.equal(logged, true);
  }
});


function shadowTestInput(
  authoritative: LocalAiShadowScheduleInput["authoritative"],
): LocalAiShadowScheduleInput {
  return {
    unlockAttemptId: "synthetic-attempt-001",
    questionText: "Synthetic shadow question",
    answerText: "Synthetic shadow answer used only by this test.",
    authoritative,
  };
}

function shadowTestEnvironment(
  token = "synthetic-service-token",
): Record<string, string | undefined> {
  return {
    UNSTANDARD_LOCAL_AI_SHADOW_ENABLED: "true",
    UNSTANDARD_LOCAL_AI_SHADOW_URL: "https://depth.example.test/internal/depth/shadow-evaluate",
    UNSTANDARD_LOCAL_AI_SHADOW_TOKEN: token,
  };
}

function validShadowResponse(): Response {
  return new Response(JSON.stringify({
    depth_score: 0.72,
    verdict: "PASS",
    path: "BASIC",
    reason_codes: ["PASS_THRESHOLD"],
    model_version: LOCAL_AI_SHADOW_MODEL_VERSION,
    latency_ms: 25,
    features: { personal_grounding_score: 0.7 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("scheduled shadow flow sends synthetic input and persists only sanitized output for the same attempt", async () => {
  const authoritative = { verdict: "PASS", unlocked: true, idempotent: false };
  const events: string[] = [];
  const persisted: Array<{ unlockAttemptId: string; evaluation: unknown }> = [];
  const failureCodes: string[] = [];
  let callback: (() => Promise<void>) | undefined;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  scheduleLocalAiShadowFlow(shadowTestInput(authoritative), {
    env: shadowTestEnvironment(),
    schedule: (task) => {
      events.push("scheduled");
      callback = task;
    },
    fetchImpl: async (input, init) => {
      events.push("fetch");
      requestUrl = String(input);
      requestInit = init;
      return validShadowResponse();
    },
    persistEvaluation: async (unlockAttemptId, evaluation) => {
      events.push("persist");
      persisted.push({ unlockAttemptId, evaluation });
    },
    logFailure: (code) => failureCodes.push(code),
  });

  assert.deepEqual(events, ["scheduled"]);
  assert.equal(persisted.length, 0);
  assert.ok(callback);
  await callback();

  assert.deepEqual(events, ["scheduled", "fetch", "persist"]);
  assert.equal(requestUrl, "https://depth.example.test/internal/depth/shadow-evaluate");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.redirect, "error");
  assert.equal(
    new Headers(requestInit?.headers).get("x-unstandard-depth-service-token"),
    "synthetic-service-token",
  );
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    question_text: "Synthetic shadow question",
    answer_text: "Synthetic shadow answer used only by this test.",
  });
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.unlockAttemptId, "synthetic-attempt-001");
  assert.equal((persisted[0]?.evaluation as { verdict: string }).verdict, "PASS");
  assert.doesNotMatch(JSON.stringify(persisted), /Synthetic shadow/);
  assert.deepEqual(failureCodes, []);
  assert.deepEqual(authoritative, { verdict: "PASS", unlocked: true, idempotent: false });
});

test("default-off shadow flow schedules no work", () => {
  let scheduled = false;
  let fetched = false;
  let persisted = false;
  scheduleLocalAiShadowFlow(shadowTestInput({
    verdict: "PASS",
    unlocked: true,
    idempotent: false,
  }), {
    env: {},
    schedule: () => { scheduled = true; },
    fetchImpl: async () => { fetched = true; return validShadowResponse(); },
    persistEvaluation: async () => { persisted = true; },
    logFailure: () => {},
  });
  assert.equal(scheduled, false);
  assert.equal(fetched, false);
  assert.equal(persisted, false);
});

test("scheduled shadow failures stay contained across token, network, response, and repository faults", async (t) => {
  const faults = [
    "wrong-token",
    "timeout",
    "http-500",
    "malformed",
    "oversized-stream",
    "repository-failure",
  ] as const;

  for (const fault of faults) {
    await t.test(fault, async () => {
      const authoritative = { verdict: "PASS", unlocked: true, idempotent: false };
      const authoritativeBefore = { ...authoritative };
      const failureCodes: string[] = [];
      let callback: (() => Promise<void>) | undefined;
      let persistCalls = 0;
      let cancelledOversizedBody = false;
      const token = fault === "wrong-token" ? "wrong-synthetic-token" : "synthetic-service-token";

      scheduleLocalAiShadowFlow(shadowTestInput(authoritative), {
        env: shadowTestEnvironment(token),
        schedule: (task) => { callback = task; },
        fetchImpl: async (_input, init) => {
          if (fault === "wrong-token") {
            assert.equal(new Headers(init?.headers).get("x-unstandard-depth-service-token"), "wrong-synthetic-token");
            return new Response("Unauthorized", { status: 401 });
          }
          if (fault === "timeout") throw new DOMException("synthetic timeout", "TimeoutError");
          if (fault === "http-500") return new Response("synthetic service error", { status: 500 });
          if (fault === "malformed") return new Response("{", { status: 200 });
          if (fault === "oversized-stream") {
            const body = new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(32_769));
              },
              cancel() {
                cancelledOversizedBody = true;
              },
            });
            return new Response(body, { status: 200 });
          }
          return validShadowResponse();
        },
        persistEvaluation: async () => {
          persistCalls += 1;
          if (fault === "repository-failure") throw new Error("synthetic database failure");
        },
        logFailure: (code) => failureCodes.push(code),
      });

      assert.ok(callback);
      await assert.doesNotReject(callback);
      assert.deepEqual(authoritative, authoritativeBefore);
      assert.deepEqual(failureCodes, ["OBSERVATION_FAILED"]);
      assert.equal(persistCalls, fault === "repository-failure" ? 1 : 0);
      if (fault === "oversized-stream") assert.equal(cancelledOversizedBody, true);
      assert.doesNotMatch(JSON.stringify(failureCodes), /Synthetic shadow|synthetic-service-token/);
    });
  }
});
