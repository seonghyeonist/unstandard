import { getCurrentUser } from "@/lib/api/auth";
import { appendReport, type ReportRecord } from "@/lib/api/report-store";
import type { ReportTargetType } from "@/types/api";

export type ReportResult = {
  ok: true;
  id: string;
};

const VALID_TARGET_TYPES = new Set<ReportTargetType>(["profile", "message", "answer"]);
const MAX_TARGET_ID_LENGTH = 128;
const MAX_REASON_LENGTH = 500;

function validateReportInput(targetType: string, targetId: string, reason: string): void {
  if (!VALID_TARGET_TYPES.has(targetType as ReportTargetType)) {
    throw new Error("Invalid report target type");
  }
  const trimmedId = targetId.trim();
  if (!trimmedId || trimmedId.length > MAX_TARGET_ID_LENGTH) {
    throw new Error("Invalid report target id");
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > MAX_REASON_LENGTH) {
    throw new Error("Invalid report reason");
  }
}

export async function reportTarget(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Report requires an authenticated session");
  }

  validateReportInput(targetType, targetId, reason);

  const record: ReportRecord = {
    id: crypto.randomUUID(),
    reporterUserId: user.id,
    targetType,
    targetId: targetId.trim(),
    reason: reason.trim(),
    createdAt: new Date().toISOString(),
    status: "OPEN",
  };

  appendReport(record);

  return { ok: true, id: record.id };
}
