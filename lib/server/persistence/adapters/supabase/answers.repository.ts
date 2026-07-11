import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canMarkProfileOnboarded } from "@/lib/server/persistence/onboarding-finalize";
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

async function hasDepthEvaluation(answerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("depth_evaluations")
    .select("id")
    .eq("answer_id", answerId)
    .maybeSingle();

  if (error) {
    throw new Error("Evaluation lookup failed");
  }

  return Boolean(data);
}

async function upsertProfileMetadata(
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
      .update({ nickname, updated_at: now })
      .eq("id", userId);

    return updateError ? "setup_required" : "ok";
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    nickname,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname, updated_at: now })
        .eq("id", userId);
      return updateError ? "setup_required" : "ok";
    }
    return "setup_required";
  }

  return "ok";
}

async function markProfileOnboarded(userId: string, nickname: string): Promise<"ok" | "setup_required"> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ nickname, onboarded_at: now, updated_at: now })
    .eq("id", userId);

  if (error) {
    return "setup_required";
  }

  return "ok";
}

async function insertDepthEvaluation(
  input: SaveOnboardingAnswerInput,
  answerId: string,
): Promise<"ok" | "db_error"> {
  const supabase = await createClient();
  const { error } = await supabase.from("depth_evaluations").insert({
    answer_id: answerId,
    user_id: input.userId,
    verdict: input.evaluation.verdict,
    score: input.evaluation.score,
    path: input.evaluation.path,
    reason_codes: input.evaluation.reasonCodes,
    model_version: input.evaluation.modelVersion,
  });

  return error ? "db_error" : "ok";
}

async function finalizeOnboardingProfile(
  input: SaveOnboardingAnswerInput,
  state: {
    existingAnswerId: string | null;
    existingEvaluationComplete: boolean;
    answerInserted: boolean;
    evaluationInserted: boolean;
  },
): Promise<"ok" | "setup_required"> {
  if (!canMarkProfileOnboarded(state)) {
    return "setup_required";
  }

  return markProfileOnboarded(input.userId, input.nickname);
}

async function completeExistingOnboardingAnswer(
  input: SaveOnboardingAnswerInput,
  answerId: string,
): Promise<SaveOnboardingAnswerResult> {
  const metadataResult = await upsertProfileMetadata(input.userId, input.nickname);
  if (metadataResult !== "ok") {
    return saveOnboardingAnswerFailure("SETUP_REQUIRED");
  }

  let evaluationComplete = await hasDepthEvaluation(answerId);
  if (!evaluationComplete) {
    const evaluationResult = await insertDepthEvaluation(input, answerId);
    if (evaluationResult !== "ok") {
      return saveOnboardingAnswerFailure("DB_ERROR");
    }
    evaluationComplete = true;
  }

  const finalizeResult = await finalizeOnboardingProfile(input, {
    existingAnswerId: answerId,
    existingEvaluationComplete: evaluationComplete,
    answerInserted: false,
    evaluationInserted: false,
  });

  if (finalizeResult !== "ok") {
    return saveOnboardingAnswerFailure("SETUP_REQUIRED");
  }

  return saveOnboardingAnswerSuccess(answerId, true);
}

async function saveOnboardingAnswer(input: SaveOnboardingAnswerInput): Promise<SaveOnboardingAnswerResult> {
  try {
    const existing = await findExistingOnboardingAnswer(input.userId, input.questionId);
    if (existing) {
      return completeExistingOnboardingAnswer(input, existing.id);
    }

    const metadataResult = await upsertProfileMetadata(input.userId, input.nickname);
    if (metadataResult !== "ok") {
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
          return completeExistingOnboardingAnswer(input, duplicate.id);
        }
      }
      if (answerError.code === "23503") {
        return saveOnboardingAnswerFailure("SETUP_REQUIRED");
      }
      return saveOnboardingAnswerFailure("DB_ERROR");
    }

    const answerId = answerRow.id as string;

    const evaluationResult = await insertDepthEvaluation(input, answerId);
    if (evaluationResult !== "ok") {
      return saveOnboardingAnswerFailure("DB_ERROR");
    }

    const finalizeResult = await finalizeOnboardingProfile(input, {
      existingAnswerId: null,
      existingEvaluationComplete: false,
      answerInserted: true,
      evaluationInserted: true,
    });

    if (finalizeResult !== "ok") {
      return saveOnboardingAnswerFailure("SETUP_REQUIRED");
    }

    return saveOnboardingAnswerSuccess(answerId, false);
  } catch {
    return saveOnboardingAnswerFailure("DB_ERROR");
  }
}
