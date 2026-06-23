import "server-only";

import type { ReportRecord } from "@/lib/api/report-store";

/**
 * Ephemeral server-side report buffer for mock/dev until Supabase persistence.
 *
 * NON-ALPHA-SAFE:
 * - Lost on server restart / multi-instance deploy
 * - Not visible to moderators
 * - Must be replaced with Supabase `reports` table before 50-person alpha
 */
const serverReports: ReportRecord[] = [];

export function appendServerReport(record: ReportRecord): ReportRecord {
  serverReports.push(record);
  return record;
}

export function listServerReports(): ReportRecord[] {
  return [...serverReports];
}
