/**
 * Deterministic, explainable mock for the future Depth Score service.
 *
 * This is NOT AI. It is a transparent local heuristic used to drive
 * MVP/alpha behavior before the real local-AI depth-service is wired in.
 * The decision ordering (spam guard -> fast-track -> gray-band -> basic
 * threshold) mirrors `services/depth-service` so the contract stays stable.
 */

export const DEPTH_MOCK_MODEL_VERSION = "mock-local-heuristic-v0.0";

export type DepthVerdict = "PASS" | "REVIEW" | "REJECT";
export type DepthPath = "BASIC" | "FAST_TRACK" | "GRAY_BAND" | "SPAM_REJECT";

export type DepthFeatures = {
  length: number;
  hasSpecificitySignal: boolean;
  hasEmotionalSignal: boolean;
  repeatPenalty: number;
  genericPenalty: number;
  symbolPenalty: number;
};

export type DepthEvaluation = {
  score: number;
  verdict: DepthVerdict;
  path: DepthPath;
  reasonCodes: string[];
  features: DepthFeatures;
  modelVersion: typeof DEPTH_MOCK_MODEL_VERSION;
};

export type DepthAnswerInput = {
  questionText: string;
  answerText: string;
};

// Thresholds intentionally aligned with services/depth-service defaults.
const THRESHOLD = 0.38;
const FAST_TRACK_SCORE = 0.55;
const GRAY_BAND = 0.03;
const MIN_LENGTH = 12;
const FAST_TRACK_MIN_LENGTH = 8;
const SPAM_GUARD = 0.6;

const SPECIFICITY_RE =
  /\d|어제|오늘|내일|아침|점심|저녁|새벽|밤|주말|아까|방금|지난|최근|편의점|카페|버스|지하철|학교|회사|집|길|공원|시장|골목|가게|역|비|눈|커피|고양이|강아지|노래|책|영화|음악|사진/u;

const EMOTIONAL_RE =
  /좋|싫|행복|슬프|슬펐|웃|울|설레|편안|그립|그리워|외로|위로|마음|느낌|고마|미안|두렵|불안|벅차|뭉클|환해|따뜻|반가|먼저|보다|중요|사람|소중|진심/u;

const GENERIC_RE =
  /그냥|몰라|모르겠|없어요|없음|보통|평범|그저|특별한 건 없|딱히|글쎄|그랬어|뭐\s/gu;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const round = (value: number): number => Math.round(value * 1e4) / 1e4;

function longestCharRun(chars: string[]): number {
  let max = 0;
  let current = 0;
  let previous = "";
  for (const char of chars) {
    if (char === previous) {
      current += 1;
    } else {
      current = 1;
      previous = char;
    }
    if (current > max) max = current;
  }
  return max;
}

function maxTokenFrequency(tokens: string[]): number {
  const counts = new Map<string, number>();
  let max = 0;
  for (const token of tokens) {
    const next = (counts.get(token) ?? 0) + 1;
    counts.set(token, next);
    if (next > max) max = next;
  }
  return max;
}

export function evaluateDepthAnswer(input: DepthAnswerInput): DepthEvaluation {
  const trimmed = input.answerText.trim();
  const chars = Array.from(trimmed);
  const length = chars.length;

  const nonSpace = chars.filter((char) => !/\s/u.test(char));
  const meaningful = nonSpace.filter((char) =>
    /[0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(char),
  );
  const symbolPenalty = nonSpace.length
    ? clamp((nonSpace.length - meaningful.length) / nonSpace.length, 0, 1)
    : 0;

  const runPenalty = clamp((longestCharRun(chars) - 1) / 3, 0, 1);
  const tokens = trimmed.split(/\s+/u).filter(Boolean);
  const tokenRepeatPenalty = clamp((maxTokenFrequency(tokens) - 2) / 3, 0, 1);
  const repeatPenalty = clamp(Math.max(runPenalty, tokenRepeatPenalty), 0, 1);

  const genericHits = trimmed.match(GENERIC_RE)?.length ?? 0;
  const genericPenalty = clamp(genericHits / 3, 0, 1);

  const hasSpecificitySignal = SPECIFICITY_RE.test(trimmed);
  const hasEmotionalSignal = EMOTIONAL_RE.test(trimmed);

  const features: DepthFeatures = {
    length,
    hasSpecificitySignal,
    hasEmotionalSignal,
    repeatPenalty: round(repeatPenalty),
    genericPenalty: round(genericPenalty),
    symbolPenalty: round(symbolPenalty),
  };

  const finish = (
    score: number,
    verdict: DepthVerdict,
    path: DepthPath,
    reasonCodes: string[],
  ): DepthEvaluation => ({
    score: round(clamp(score, 0, 1)),
    verdict,
    path,
    reasonCodes,
    features,
    modelVersion: DEPTH_MOCK_MODEL_VERSION,
  });

  // --- Hard guards (deterministic rejects) ---
  if (length === 0) {
    return finish(0, "REJECT", "SPAM_REJECT", ["EMPTY"]);
  }
  if (symbolPenalty >= SPAM_GUARD) {
    return finish(0, "REJECT", "SPAM_REJECT", ["SYMBOL_ONLY"]);
  }
  if (repeatPenalty >= SPAM_GUARD) {
    return finish(0, "REJECT", "SPAM_REJECT", ["REPEAT_DOMINANT"]);
  }
  if (genericPenalty >= SPAM_GUARD && !hasSpecificitySignal && !hasEmotionalSignal) {
    return finish(0, "REJECT", "SPAM_REJECT", ["GENERIC_DOMINANT"]);
  }

  // --- Positive signals ---
  const specificityScore = hasSpecificitySignal ? 0.25 : 0;
  const emotionalScore = hasEmotionalSignal ? 0.3 : 0;
  const lengthScore = clamp(length / 60, 0, 1) * 0.15;
  const diversityRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const diversityScore = diversityRatio * clamp(tokens.length / 5, 0, 1) * 0.3;

  const penalty =
    repeatPenalty * 0.5 + genericPenalty * 0.35 + symbolPenalty * 0.6;

  const score = clamp(
    specificityScore + emotionalScore + lengthScore + diversityScore - penalty,
    0,
    1,
  );

  const signalCodes: string[] = [];
  if (hasSpecificitySignal) signalCodes.push("HAS_SPECIFICITY");
  if (hasEmotionalSignal) signalCodes.push("HAS_EMOTION");
  if (genericPenalty > 0) signalCodes.push("GENERIC_LANGUAGE");

  // --- Verdict ordering: fast-track -> gray-band -> basic -> reject ---
  if (score >= FAST_TRACK_SCORE && length >= FAST_TRACK_MIN_LENGTH) {
    return finish(score, "PASS", "FAST_TRACK", ["FAST_TRACK_SCORE", ...signalCodes]);
  }
  if (Math.abs(score - THRESHOLD) <= GRAY_BAND) {
    return finish(score, "REVIEW", "GRAY_BAND", ["GRAY_BAND", ...signalCodes]);
  }
  if (score >= THRESHOLD && length >= MIN_LENGTH) {
    return finish(score, "PASS", "BASIC", ["BASIC_PASS", ...signalCodes]);
  }

  const rejectCodes = ["BELOW_THRESHOLD", ...signalCodes];
  if (length < MIN_LENGTH) rejectCodes.push("TOO_SHORT");
  return finish(score, "REJECT", "BASIC", rejectCodes);
}
