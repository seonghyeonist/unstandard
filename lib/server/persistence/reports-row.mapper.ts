import type { ReportTargetType } from "@/types/api";

export type ReportRecord = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: "OPEN" | "REVIEWED" | "CLOSED";
  createdAt: string;
};

export type ReportRow = {
  id: string;
  reporterUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: Date | string;
};

export function mapReportRowToRecord(row: ReportRow): ReportRecord {
  if (row.status !== "OPEN") {
    throw new Error("Expected OPEN report row");
  }

  return {
    id: row.id,
    reporterUserId: row.reporterUserId,
    targetType: row.targetType as ReportTargetType,
    targetId: row.targetId,
    reason: row.reason,
    status: "OPEN",
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}
