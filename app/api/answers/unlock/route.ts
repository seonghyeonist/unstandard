import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedUser } from "@/lib/auth/server";
import { candidates, onboardingQuestion } from "@/lib/data/mock-public";
import { evaluateDepthAnswer } from "@/lib/depth/evaluate-depth-answer";
import { setUnlockCookie } from "@/lib/server/unlock-cookies";
import { apiFetch, hasApiBaseUrl } from "@/lib/api/client";

type DepthEvaluateResponse = {
  verdict: "PASS" | "REVIEW" | "REJECT";
  reason_codes?: string[];
};

function questionForProfile(profileId: string): string {
  return candidates.find((candidate) => candidate.id === profileId)?.question ?? "";
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = typeof (body as { profileId?: unknown }).profileId === "string"
    ? (body as { profileId: string }).profileId.trim()
    : "";
  const answer = typeof (body as { answer?: unknown }).answer === "string"
    ? (body as { answer: string }).answer
    : "";

  if (!profileId || !/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    return NextResponse.json({ error: "Invalid profileId" }, { status: 400 });
  }

  if (!answer.trim()) {
    return NextResponse.json({ error: "Answer required" }, { status: 400 });
  }

  try {
    let verdict: "PASS" | "REVIEW" | "REJECT" | "ERROR";
    let reasonCodes: string[] = [];

    if (hasApiBaseUrl()) {
      const response = await apiFetch<DepthEvaluateResponse>("/internal/depth/evaluate", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          question_id: onboardingQuestion.id,
          answer_id: crypto.randomUUID(),
          question_text: questionForProfile(profileId),
          answer_text: answer,
        }),
      });
      verdict = response.verdict;
      reasonCodes = response.reason_codes ?? [];
    } else {
      const evaluation = evaluateDepthAnswer({
        questionText: questionForProfile(profileId),
        answerText: answer,
      });
      verdict = evaluation.verdict;
      reasonCodes = evaluation.reasonCodes;
    }

    if (verdict === "PASS") {
      await setUnlockCookie(profileId, user.id);
    }

    return NextResponse.json({ verdict, reasonCodes });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ verdict: "ERROR", reasonCodes: [] }, { status: 500 });
  }
}
