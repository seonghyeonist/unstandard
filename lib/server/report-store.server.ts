import "server-only";

import type { ReportRecord } from "@/lib/api/report-store";

/**
 * @deprecated Unused by POST /api/reports — replaced by ReportsRepository (alpha adapter).
 * Kept for rollback reference only. Do not wire back without explicit approval.
 *
 * Ephemeral server-side report buffer (NON-ALPHA-SAFE).
 */
const serverReports: ReportRecord[] = [];

export function appendServerReport(record: ReportRecord): ReportRecord {
  serverReports.push(record);
  return record;
}

export function listServerReports(): ReportRecord[] {
  return [...serverReports];
}
