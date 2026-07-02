import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SaveOnboardingAnswerInput } from "@/lib/server/persistence/answers.types";
import {
  saveOnboardingAnswerFailure,
  saveOnboardingAnswerSuccess,
  type SaveOnboardingAnswerResult,
} from "@/lib/server/persistence/answers.types";
import type { AnswersRepository } from "@/lib/server/persistence/answers.repository.interface";

/**
 * Alpha/prototype Supabase adapter for onboarding answers persistence.
 * Not production architecture — replaceable via AnswersRepository interface.
 */
export function createSupabaseAnswersRepository(): AnswersRepository {
  return {
    saveOnboardingAnswer: (input) => saveOnboardingAnswer(input),
  };
}

async function findExistingOnboardingAnswer(
  userId: string,
  questionId: string,
): Promise<{ id: string } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("answers")
    .select("id")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error("Answer lookup failed");
  }

  return data ? { id: data.id as string } : null;
}

async function upsertOnboardingProfile(
  userId: string,
  nickname: string,
): Promise<"ok" | "setup_required"> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    return "setup_required";
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ nickname, onboarded_at: now, updated_at: now })
      .eq("id", userId);

    if (updateError) {
      return "setup_required";
    }
    return "ok";
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    nickname,
    onboarded_at: now,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname, onboarded_at: now, updated_at: now })
        .eq("id", userId);
      return updateError ? "setup_required" : "ok";
    }
    return "setup_required";
  }

  return "ok";
}

async function saveOnboardingAnswer(input: SaveOnboardingAnswerInput): Promise<SaveOnboardingAnswerResult> {
  try {
    const existing = await findExistingOnboardingAnswer(input.userId, input.questionId);
    if (existing) {
      const profileResult = await upsertOnboardingProfile(input.userId, input.nickname);
      if (profileResult !== "ok") {
        return saveOnboardingAnswerFailure("SETUP_REQUIRED");
      }
      return saveOnboardingAnswerSuccess(existing.id, true);
    }

    const profileResult = await upsertOnboardingProfile(input.userId, input.nickname);
    if (profileResult !== "ok") {
      return saveOnboardingAnswerFailure("SETUP_REQUIRED");
    }

    const supabase = await createClient();

    const { data: answerRow, error: answerError } = await supabase
      .from("answers")
      .insert({
        user_id: input.userId,
        question_id: input.questionId,
        target_profile_id: input.userId,
        answer_text: input.answerText,
      })
      .select("id")
      .single();

    if (answerError) {
      if (answerError.code === "23505") {
        const duplicate = await findExistingOnboardingAnswer(input.userId, input.questionId);
        if (duplicate) {
          return saveOnboardingAnswerSuccess(duplicate.id, true);
        }
      }
      if (answerError.code === "23503") {
        return saveOnboardingAnswerFailure("SETUP_REQUIRED");
      }
      return saveOnboardingAnswerFailure("DB_ERROR");
    }

    const answerId = answerRow.id as string;

    const { error: evaluationError } = await supabase.from("depth_evaluations").insert({
      answer_id: answerId,
      user_id: input.userId,
      verdict: input.evaluation.verdict,
      score: input.evaluation.score,
      path: input.evaluation.path,
      reason_codes: input.evaluation.reasonCodes,
      model_version: input.evaluation.modelVersion,
    });

    if (evaluationError) {
      return saveOnboardingAnswerFailure("DB_ERROR");
    }

    return saveOnboardingAnswerSuccess(answerId, false);
  } catch {
    return saveOnboardingAnswerFailure("DB_ERROR");
  }
}
