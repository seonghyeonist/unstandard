import "server-only";

import type { ReportRecord } from "@/lib/api/report-store";

/**
 * Ephemeral server-side report buffer for mock/dev until Supabase persistence.
 * Not durable across deploys — intentional for P0 foundation.
 */
const serverReports: ReportRecord[] = [];

export function appendServerReport(record: ReportRecord): ReportRecord {
  serverReports.push(record);
  return record;
}

export function listServerReports(): ReportRecord[] {
  return [...serverReports];
}
