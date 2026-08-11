import {
  DEPTH_MOCK_MODEL_VERSION,
  type DepthEvaluation,
} from "@/lib/depth/evaluate-depth-answer";

/**
 * Local persistence for the onboarding answer.
 *
 * Today this writes to `sessionStorage` (matching the mock auth layer in
 * `lib/api/auth.ts`). The shape is intentionally close to a future persisted
 * row so migration is a storage-adapter swap, not a rewrite. Keep all storage
 * logic here, out of UI components.
 */

const STORAGE_KEY = "unstandard.alpha.onboarding";

export type OnboardingResponse = {
  userId: string;
  questionId: string;
  questionText: string;
  answerText: string;
  createdAt: string;
  evaluation: Pick<DepthEvaluation, "score" | "verdict" | "path"> & {
    modelVersion: typeof DEPTH_MOCK_MODEL_VERSION;
  };
};

export function saveOnboardingResponse(response: OnboardingResponse): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
}

export function getOnboardingResponse(): OnboardingResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as OnboardingResponse) : null;
}

export function clearOnboardingResponse(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
