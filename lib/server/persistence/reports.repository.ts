import "server-only";

import { isPersistenceEnabled } from "@/lib/config/persistence-mode";
import { createClient } from "@/lib/supabase/server";
import {
  PersistenceNotConfiguredError,
  mapReportsRowToRecord,
  type CreateReportInput,
  type ReportsRow,
} from "@/lib/server/persistence/reports.mapper";

export {
  PersistenceNotConfiguredError,
  isPersistenceNotConfiguredError,
  mapReportsRowToRecord,
  resolveCreateOrGetOpenReport,
  type CreateReportInput,
} from "@/lib/server/persistence/reports.mapper";

function assertPersistenceEnabled(): void {
  if (!isPersistenceEnabled()) {
    throw new PersistenceNotConfiguredError();
  }
}

export async function findOpenDuplicateReport(
  input: CreateReportInput,
): Promise<import("@/lib/api/report-store").ReportRecord | null> {
  assertPersistenceEnabled();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("id, reporter_user_id, target_type, target_id, reason, status, created_at")
    .eq("reporter_user_id", input.reporterUserId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (error) {
    throw new Error("Report lookup failed");
  }

  if (!data) {
    return null;
  }

  return mapReportsRowToRecord(data as ReportsRow);
}

export async function createReport(
  input: CreateReportInput,
): Promise<import("@/lib/api/report-store").ReportRecord> {
  assertPersistenceEnabled();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_user_id: input.reporterUserId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason,
      status: "OPEN",
    })
    .select("id, reporter_user_id, target_type, target_id, reason, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await findOpenDuplicateReport(input);
      if (duplicate) {
        return duplicate;
      }
    }
    throw new Error("Report create failed");
  }

  return mapReportsRowToRecord(data as ReportsRow);
}

export async function createOrGetOpenReport(
  input: CreateReportInput,
): Promise<{ record: import("@/lib/api/report-store").ReportRecord; created: boolean }> {
  const existing = await findOpenDuplicateReport(input);
  if (existing) {
    return { record: existing, created: false };
  }

  const created = await createReport(input);
  return { record: created, created: true };
}
