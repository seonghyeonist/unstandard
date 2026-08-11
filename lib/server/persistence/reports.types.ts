import type { ReportTargetType } from "@/types/api";

/** Backend-agnostic report creation input — reporterUserId is the Better Auth users.id. */
export type CreateReportInput = {
  /** Better Auth user ID stored in reports.reporter_user_id */
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
};

export type CreateReportFailureCode =
  | "PERSISTENCE_DISABLED"
  | "MISSING_PROFILE"
  | "DB_ERROR";

export type CreateReportSuccess =
  | { ok: true; inserted: true; reportId: string }
  | { ok: true; inserted: false; reportId: string; duplicate: true };

export type CreateReportResult = CreateReportSuccess | { ok: false; code: CreateReportFailureCode };

export function reportSuccess(reportId: string, inserted: boolean): CreateReportSuccess {
  if (inserted) {
    return { ok: true, inserted: true, reportId };
  }
  return { ok: true, inserted: false, reportId, duplicate: true };
}

export function reportFailure(code: CreateReportFailureCode): CreateReportResult {
  return { ok: false, code };
}
