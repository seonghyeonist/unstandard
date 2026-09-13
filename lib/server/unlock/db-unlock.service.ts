import "server-only";

import { canAccessIntroduction, lockIntroductionProfiles } from "@/lib/db/repositories/introduction-policy";
import { getDb } from "@/lib/db/client";
import { getTargetProfileForUnlock } from "@/lib/db/repositories/candidates.repository";
import {
  countUnlocks,
  createUnlock,
} from "@/lib/db/repositories/unlocks.repository";
import { unlockAttempts } from "@/lib/db/schema/unlock-attempts";
import {
  DEPTH_MOCK_MODEL_VERSION,
  evaluateDepthAnswer,
  type DepthVerdict,
} from "@/lib/depth/evaluate-depth-answer";
import { getConfiguredUnlockQuestion } from "@/lib/server/unlock/question-config";
import type { UnlockErrorCode } from "@/lib/unlock/unlock-codes";
import {
  createCorrelationId,
  idPrefix,
  logDatabaseFailure,
  logUnlockEvent,
} from "@/lib/server/unlock/unlock-logger";

export type SubmitUnlockAnswerInput = {
  viewerUserId: string;
  profileId: string;
  answer: string;
};

export type SubmitUnlockAnswerSuccess = {
  ok: true;
  correlationId: string;
  verdict: DepthVerdict;
  reasonCodes: string[];
  unlocked: boolean;
  idempotent: boolean;
};

export type SubmitUnlockAnswerFailure = {
  ok: false;
  correlationId: string;
  code: UnlockErrorCode;
};

export type SubmitUnlockAnswerResult = SubmitUnlockAnswerSuccess | SubmitUnlockAnswerFailure;

const MIN_ANSWER_LEN = 12;
const MAX_ANSWER_LEN = 800;

export async function submitDbUnlockAnswer(
  input: SubmitUnlockAnswerInput,
): Promise<SubmitUnlockAnswerResult> {
  const correlationId = createCorrelationId();
  const started = Date.now();
  const viewerPrefix = idPrefix(input.viewerUserId);
  const targetPrefix = idPrefix(input.profileId);

  logUnlockEvent({
    event: "unlock.submit.start",
    correlationId,
    stage: "AUTH",
    status: "ok",
    viewerUserIdPrefix: viewerPrefix,
    targetProfileIdPrefix: targetPrefix,
  });

  const profileId = input.profileId.trim();
  const answer = input.answer.trim();

  if (!profileId || !answer) {
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "INPUT_VALIDATION",
      status: "error",
      code: "INVALID_BODY",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: targetPrefix,
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "INVALID_BODY" };
  }

  if (answer.length < MIN_ANSWER_LEN || answer.length > MAX_ANSWER_LEN) {
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "INPUT_VALIDATION",
      status: "error",
      code: "INVALID_BODY",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: targetPrefix,
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "INVALID_BODY" };
  }

  let target;
  try {
    target = await getTargetProfileForUnlock(profileId);
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "TARGET_LOOKUP",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: targetPrefix,
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }

  if (!target.ok) {
    const code = target.reason === "invalid" ? "INVALID_PROFILE_ID" : "PROFILE_NOT_FOUND";
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "TARGET_LOOKUP",
      status: "error",
      code,
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: targetPrefix,
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code };
  }

  if (!target.onboarded) {
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "TARGET_LOOKUP",
      status: "error",
      code: "PROFILE_NOT_ONBOARDED",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "PROFILE_NOT_ONBOARDED" };
  }

  if (target.userId === input.viewerUserId) {
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "TARGET_LOOKUP",
      status: "error",
      code: "SELF_UNLOCK_NOT_ALLOWED",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "SELF_UNLOCK_NOT_ALLOWED" };
  }

  try {
    if (!await canAccessIntroduction(input.viewerUserId, profileId)) return { ok: false, correlationId, code: "PROFILE_SETUP_REQUIRED" };
  } catch { return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" }; }

  let question;
  try {
    question = await getConfiguredUnlockQuestion();
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "QUESTION_LOOKUP",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }

  if (!question) {
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "QUESTION_LOOKUP",
      status: "error",
      code: "QUESTION_NOT_CONFIGURED",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "QUESTION_NOT_CONFIGURED" };
  }

  let evaluation;
  try {
    evaluation = evaluateDepthAnswer({
      questionText: question.prompt,
      answerText: answer,
    });
  } catch (error) {
    void error;
    logUnlockEvent({
      event: "unlock.submit.reject",
      correlationId,
      stage: "EVALUATION",
      status: "error",
      code: "EVALUATION_FAILED",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      durationMs: Date.now() - started,
    });
    return { ok: false, correlationId, code: "EVALUATION_FAILED" };
  }

  let unlocked = false;
  let idempotent = false;
  const db = getDb();
  try {
    const transactionResult = await db.transaction(async (tx) => {
      await lockIntroductionProfiles(tx, input.viewerUserId, profileId);
      if (!await canAccessIntroduction(input.viewerUserId, profileId, tx)) throw new Error("Introduction no longer permitted");
      await tx.insert(unlockAttempts).values({
        viewerUserId: input.viewerUserId,
        targetProfileId: target.profileId,
        questionId: question.id,
        answerText: answer,
        verdict: evaluation.verdict,
        score: String(evaluation.score),
        path: evaluation.path,
        reasonCodes: evaluation.reasonCodes,
        modelVersion: evaluation.modelVersion || DEPTH_MOCK_MODEL_VERSION,
      });

      if (evaluation.verdict !== "PASS") {
        return { unlocked: false, idempotent: false };
      }

      const created = await createUnlock(
        {
          viewerUserId: input.viewerUserId,
          profileId: target.profileId,
        },
        tx,
      );
      if (!created.ok) {
        throw new Error("unlock transaction persistence failed");
      }
      return { unlocked: true, idempotent: !created.inserted };
    });
    unlocked = transactionResult.unlocked;
    idempotent = transactionResult.idempotent;
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: evaluation.verdict === "PASS" ? "UNLOCK_UPSERT" : "ATTEMPT_INSERT",
      code: "PERSISTENCE_FAILED",
      error,
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
    });
    return { ok: false, correlationId, code: "PERSISTENCE_FAILED" };
  }

  if (evaluation.verdict === "PASS") {
    logUnlockEvent({
      event: "unlock.submit.pass",
      correlationId,
      stage: "UNLOCK_UPSERT",
      status: "ok",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      verdict: evaluation.verdict,
      idempotent,
      durationMs: Date.now() - started,
    });
  } else {
    logUnlockEvent({
      event: "unlock.submit.evaluated",
      correlationId,
      stage: "ATTEMPT_INSERT",
      status: "ok",
      viewerUserIdPrefix: viewerPrefix,
      targetProfileIdPrefix: idPrefix(target.profileId),
      verdict: evaluation.verdict,
      durationMs: Date.now() - started,
    });
  }

  return {
    ok: true,
    correlationId,
    verdict: evaluation.verdict,
    reasonCodes: evaluation.reasonCodes,
    unlocked,
    idempotent,
  };
}

export async function getDbUnlockStatus(input: {
  viewerUserId: string;
  profileId: string;
}): Promise<
  | {
      ok: true;
      profileId: string;
      unlocked: boolean;
      unlockRowCount: number;
      correlationId: string;
    }
  | { ok: false; code: UnlockErrorCode; correlationId: string }
> {
  const correlationId = createCorrelationId();
  const profileId = input.profileId.trim();

  if (!profileId) {
    return { ok: false, correlationId, code: "INVALID_PROFILE_ID" };
  }

  const target = await getTargetProfileForUnlock(profileId);
  if (!target.ok) {
    return {
      ok: false,
      correlationId,
      code: target.reason === "invalid" ? "INVALID_PROFILE_ID" : "PROFILE_NOT_FOUND",
    };
  }

  try {
    if (!await canAccessIntroduction(input.viewerUserId, profileId)) return { ok: false, correlationId, code: "PROFILE_SETUP_REQUIRED" };
    const unlockRowCount = await countUnlocks(input.viewerUserId, target.profileId);
    const unlocked = unlockRowCount === 1;
    logUnlockEvent({
      event: "unlock.status",
      correlationId,
      stage: "PRIVATE_AUTHORIZATION",
      status: "ok",
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(target.profileId),
      idempotent: unlocked,
    });
    return {
      ok: true,
      correlationId,
      profileId: target.profileId,
      unlocked,
      unlockRowCount,
    };
  } catch (error) {
    logDatabaseFailure({
      correlationId,
      stage: "PRIVATE_AUTHORIZATION",
      code: "UNLOCK_SERVICE_UNAVAILABLE",
      error,
      viewerUserIdPrefix: idPrefix(input.viewerUserId),
      targetProfileIdPrefix: idPrefix(target.profileId),
    });
    return { ok: false, correlationId, code: "UNLOCK_SERVICE_UNAVAILABLE" };
  }
}
