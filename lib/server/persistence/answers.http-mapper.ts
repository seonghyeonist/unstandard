import type { SaveOnboardingAnswerResult } from "@/lib/server/persistence/answers.types";

export function mapSaveOnboardingAnswerResultToHttp(result: SaveOnboardingAnswerResult): {
  status: number;
  body: Record<string, unknown>;
} {
  if (result.ok) {
    return {
      status: result.duplicate ? 200 : 201,
      body: { ok: true, answerId: result.answerId },
    };
  }

  switch (result.code) {
    case "PERSISTENCE_DISABLED":
      return { status: 503, body: { error: "Answers persistence is disabled" } };
    case "SETUP_REQUIRED":
      return { status: 409, body: { error: "Profile setup required" } };
    case "INVALID_INPUT":
      return { status: 400, body: { error: "Invalid onboarding answer" } };
    case "DB_ERROR":
    default:
      return { status: 500, body: { error: "Failed to save onboarding answer" } };
  }
}
