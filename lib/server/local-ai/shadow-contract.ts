export const LOCAL_AI_SHADOW_MODEL_VERSION = "local-v0.2+bge-m3";
export const LOCAL_AI_SHADOW_TIMEOUT_MS = 1_500;

export type LocalAiShadowConfig = {
  endpoint: string;
  serviceToken: string;
};

export function getLocalAiShadowConfig(
  env: Record<string, string | undefined>,
): LocalAiShadowConfig | null {
  if (env.UNSTANDARD_LOCAL_AI_SHADOW_ENABLED !== "true") return null;

  const endpoint = env.UNSTANDARD_LOCAL_AI_SHADOW_URL?.trim();
  const serviceToken = env.UNSTANDARD_LOCAL_AI_SHADOW_TOKEN?.trim();
  if (!endpoint || !serviceToken) return null;

  try {
    const parsed = new URL(endpoint);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !parsed.pathname.endsWith("/internal/depth/shadow-evaluate")
    ) return null;
    return { endpoint: parsed.toString(), serviceToken };
  } catch {
    return null;
  }
}

export type LocalAiShadowEvaluation = {
  depthScore: number;
  verdict: "PASS" | "REVIEW" | "REJECT";
  path: string;
  reasonCodes: string[];
  modelVersion: string;
  latencyMs: number;
  features: {
    personalGroundingScore: number | null;
    ungroundedAbstractPenalty: number | null;
    abstractStyleHits: number | null;
    relevanceScore: number | null;
    specificityScore: number | null;
    repeatPatternPenalty: number | null;
    emojiSymbolPenalty: number | null;
    spamSignaturePenalty: number | null;
  };
};

export class LocalAiShadowResponseError extends Error {
  constructor(readonly code: "MALFORMED_RESPONSE" | "MODEL_VERSION_MISMATCH") {
    super(code);
    this.name = "LocalAiShadowResponseError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalNumber(
  features: Record<string, unknown>,
  key: string,
  maximum = 1,
): number | null {
  const value = features[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  }
  return value;
}

export function parseLocalAiShadowEvaluation(
  value: unknown,
  expectedModelVersion = LOCAL_AI_SHADOW_MODEL_VERSION,
): LocalAiShadowEvaluation {
  const body = record(value);
  if (!body) throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  if ("question_text" in body || "answer_text" in body || "embedding" in body) {
    throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  }

  const depthScore = body.depth_score;
  const verdict = body.verdict;
  const path = body.path;
  const reasonCodes = body.reason_codes;
  const modelVersion = body.model_version;
  const latencyMs = body.latency_ms;
  const rawFeatures = record(body.features);

  if (
    typeof depthScore !== "number" ||
    !Number.isFinite(depthScore) ||
    depthScore < 0 ||
    depthScore > 1 ||
    (verdict !== "PASS" && verdict !== "REVIEW" && verdict !== "REJECT") ||
    typeof path !== "string" ||
    !/^[A-Z_]{1,48}$/.test(path) ||
    !Array.isArray(reasonCodes) ||
    reasonCodes.length > 32 ||
    !reasonCodes.every((code) => typeof code === "string" && /^[A-Z0-9_]{1,48}$/.test(code)) ||
    typeof modelVersion !== "string" ||
    typeof latencyMs !== "number" ||
    !Number.isInteger(latencyMs) ||
    latencyMs < 0 ||
    latencyMs > 120_000 ||
    !rawFeatures
  ) {
    throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  }

  if (modelVersion !== expectedModelVersion) {
    throw new LocalAiShadowResponseError("MODEL_VERSION_MISMATCH");
  }
  if (["question_text", "answer_text", "embedding", "answer_embedding"].some((key) => key in rawFeatures)) {
    throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  }

  const abstractStyleHits = optionalNumber(rawFeatures, "abstract_style_hits", 64);
  if (abstractStyleHits !== null && !Number.isInteger(abstractStyleHits)) {
    throw new LocalAiShadowResponseError("MALFORMED_RESPONSE");
  }

  return {
    depthScore,
    verdict,
    path,
    reasonCodes: [...reasonCodes] as string[],
    modelVersion,
    latencyMs,
    features: {
      personalGroundingScore: optionalNumber(rawFeatures, "personal_grounding_score"),
      ungroundedAbstractPenalty: optionalNumber(rawFeatures, "ungrounded_abstract_penalty"),
      abstractStyleHits,
      relevanceScore: optionalNumber(rawFeatures, "relevance_score"),
      specificityScore: optionalNumber(rawFeatures, "specificity_score"),
      repeatPatternPenalty: optionalNumber(rawFeatures, "repeat_pattern_penalty"),
      emojiSymbolPenalty: optionalNumber(rawFeatures, "emoji_symbol_penalty"),
      spamSignaturePenalty: optionalNumber(rawFeatures, "spam_signature_penalty"),
    },
  };
}
