import type { ReportRecord } from "@/lib/api/report-store";
import type { ReportTargetType } from "@/types/api";

/** Supabase/Postgres row shape — alpha adapter only; not a domain type. */
export type SupabaseReportsRow = {
  id: string;
  reporter_user_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
};

export function mapSupabaseReportsRowToRecord(row: SupabaseReportsRow): ReportRecord {
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
