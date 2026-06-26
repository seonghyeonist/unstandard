import type { ReportTargetType } from "@/types/api";

const VALID_TARGET_TYPES = new Set<ReportTargetType>(["profile", "message", "answer"]);
const MAX_TARGET_ID_LENGTH = 128;
const MAX_REASON_LENGTH = 500;
const TARGET_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type ReportInput = {
  targetType: string;
  targetId: string;
  reason: string;
  reporterUserId?: string;
};

export function validateReportInput(input: ReportInput): {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
} {
  if (!VALID_TARGET_TYPES.has(input.targetType as ReportTargetType)) {
    throw new Error("Invalid report target type");
  }

  const targetId = input.targetId.trim();
  if (!targetId || targetId.length > MAX_TARGET_ID_LENGTH || !TARGET_ID_PATTERN.test(targetId)) {
    throw new Error("Invalid report target id");
  }

  const reason = input.reason.trim();
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    throw new Error("Invalid report reason");
  }

  if (input.reporterUserId !== undefined) {
    throw new Error("reporterUserId must not be supplied by client");
  }

  return {
    targetType: input.targetType as ReportTargetType,
    targetId,
    reason,
  };
}

/** Server-only validation with authenticated reporter context. */
export function validateReportForUser(
  input: ReportInput,
  reporterUserId: string,
): {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
} {
  const validated = validateReportInput(input);

  if (validated.targetType === "profile" && validated.targetId === reporterUserId) {
    throw new Error("Cannot report your own profile");
  }

  return validated;
}
