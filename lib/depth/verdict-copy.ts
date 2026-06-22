import type { DepthVerdict } from "@/lib/depth/evaluate-depth-answer";

/**
 * Maps a verdict + internal reasonCodes to warm, user-facing Korean copy.
 *
 * Never exposes score, threshold, "Depth Score", or internal path names
 * (BASIC/FAST_TRACK/GRAY_BAND/SPAM_REJECT). Tone stays kind and never shames.
 */

export type VerdictCopy = {
  title: string;
  description: string;
};

export function verdictCopy(input: {
  verdict: DepthVerdict;
  reasonCodes: string[];
}): VerdictCopy {
  const has = (code: string) => input.reasonCodes.includes(code);

  if (input.verdict === "PASS") {
    return {
      title: "이 사람의 세계가 보이기 시작해요.",
      description: "당신의 장면이 잘 전해졌어요. 잠겨 있던 카드가 열렸어요.",
    };
  }

  if (input.verdict === "REVIEW") {
    return {
      title: "거의 다 왔어요.",
      description: "조금만 더 구체적으로 적으면 상대의 카드가 열릴 수 있어요.",
    };
  }

  // REJECT — pick the reason that best matches, never default to "too short".
  if (has("SYMBOL_ONLY")) {
    return {
      title: "기호만으로는 아직 열기 어려워요.",
      description: "짧아도 괜찮지만, 당신의 말이 조금은 담겨야 해요.",
    };
  }

  if (has("REPEAT_DOMINANT") || has("GENERIC_DOMINANT") || has("GENERIC_LANGUAGE")) {
    return {
      title: "조금 더 구체적으로 적어볼까요?",
      description: "좋다/싫다보다 어떤 장면에서 그렇게 느끼는지 적어주면 더 잘 전달돼요.",
    };
  }

  if (has("EMPTY") || has("TOO_SHORT")) {
    return {
      title: "조금만 더 적어주세요.",
      description: "한 문장만 더 있어도 상대가 당신을 훨씬 잘 이해할 수 있어요.",
    };
  }

  return {
    title: "조금 더 구체적으로 적어볼까요?",
    description: "좋다/싫다보다 어떤 장면에서 그렇게 느끼는지 적어주면 더 잘 전달돼요.",
  };
}
