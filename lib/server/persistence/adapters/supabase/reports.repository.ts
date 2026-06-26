import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CreateReportInput } from "@/lib/server/persistence/reports.types";
import {
  reportFailure,
  reportSuccess,
  type CreateReportResult,
} from "@/lib/server/persistence/reports.types";
import type { ReportsRepository } from "@/lib/server/persistence/reports.repository.interface";
import {
  mapSupabaseReportsRowToRecord,
  type SupabaseReportsRow,
} from "@/lib/server/persistence/adapters/supabase/reports-row.mapper";

/**
 * Alpha/prototype Supabase adapter for reports persistence.
 * Not production architecture — replaceable via ReportsRepository interface.
 */
export function createSupabaseReportsRepository(): ReportsRepository {
  return {
    createOrGetOpenReport: (input) => createOrGetOpenReport(input),
  };
}

async function findOpenDuplicateReport(
  input: CreateReportInput,
): Promise<{ id: string } | null> {
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

  const record = mapSupabaseReportsRowToRecord(data as SupabaseReportsRow);
  return { id: record.id };
}

async function insertReport(input: CreateReportInput): Promise<CreateReportResult> {
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
        return reportSuccess(duplicate.id, false);
      }
    }
    if (error.code === "23503") {
      return reportFailure("MISSING_PROFILE");
    }
    return reportFailure("DB_ERROR");
  }

  const record = mapSupabaseReportsRowToRecord(data as SupabaseReportsRow);
  return reportSuccess(record.id, true);
}

async function createOrGetOpenReport(input: CreateReportInput): Promise<CreateReportResult> {
  try {
    const existing = await findOpenDuplicateReport(input);
    if (existing) {
      return reportSuccess(existing.id, false);
    }

    return await insertReport(input);
  } catch {
    return reportFailure("DB_ERROR");
  }
}
