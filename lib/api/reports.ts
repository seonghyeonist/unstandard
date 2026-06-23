import { getCurrentUser } from "@/lib/api/auth";
import { appendReport, type ReportRecord } from "@/lib/api/report-store";
import type { ReportTargetType } from "@/types/api";

export type ReportResult = {
  ok: true;
  id: string;
};

export async function reportTarget(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<ReportResult> {
  const user = await getCurrentUser();

  const record: ReportRecord = {
    id: crypto.randomUUID(),
    reporterUserId: user?.id,
    targetType,
    targetId,
    reason,
    createdAt: new Date().toISOString(),
    status: "OPEN",
  };

  appendReport(record);

  return { ok: true, id: record.id };
}
