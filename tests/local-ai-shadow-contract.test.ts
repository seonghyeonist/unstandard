import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocalAiShadowConfig,
  LOCAL_AI_SHADOW_MODEL_VERSION,
  parseLocalAiShadowEvaluation,
} from "@/lib/server/local-ai/shadow-contract";
import { preserveAuthoritativeUnlock } from "@/lib/server/local-ai/shadow-invariant";

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
