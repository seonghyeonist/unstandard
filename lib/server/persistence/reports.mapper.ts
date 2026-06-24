import type { ReportRecord } from "../../api/report-store";
import type { ReportTargetType } from "../../../types/api";

export class PersistenceNotConfiguredError extends Error {
  constructor() {
    super("Report persistence is not configured");
    this.name = "PersistenceNotConfiguredError";
  }
}

export function isPersistenceNotConfiguredError(error: unknown): boolean {
  return error instanceof PersistenceNotConfiguredError;
}

type ReportsRow = {
  id: string;
  reporter_user_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
};

export type CreateReportInput = {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
};

/** Pure row mapper — unit tested without Supabase. */
export function mapReportsRowToRecord(row: ReportsRow): ReportRecord {
  if (row.status !== "OPEN") {
    throw new Error("Unexpected report status for open report mapper");
  }

  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    createdAt: row.created_at,
    status: "OPEN",
  };
}

/** Pure duplicate resolution — unit tested without Supabase. */
export function resolveCreateOrGetOpenReport(
  existing: ReportRecord | null,
  created: ReportRecord,
): { record: ReportRecord; created: boolean } {
  if (existing) {
    return { record: existing, created: false };
  }
  return { record: created, created: true };
}

export type { ReportsRow };
