import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { reports } from "@/lib/db/schema/reports";
import type { ReportsRepository } from "@/lib/server/persistence/reports.repository.interface";
import type { CreateReportInput } from "@/lib/server/persistence/reports.types";
import {
  reportFailure,
  reportSuccess,
  type CreateReportResult,
} from "@/lib/server/persistence/reports.types";

export function createDrizzleReportsRepository(): ReportsRepository {
  return {
    createOrGetOpenReport: (input) => createOrGetOpenReport(input),
  };
}

async function findOpenDuplicateReport(
  input: CreateReportInput,
): Promise<{ id: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterUserId, input.reporterUserId),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId),
        eq(reports.status, "OPEN"),
      ),
    )
    .limit(1);

  return row ?? null;
}

async function insertReport(input: CreateReportInput): Promise<CreateReportResult> {
  const db = getDb();

  try {
    const [row] = await db
      .insert(reports)
      .values({
        reporterUserId: input.reporterUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        status: "OPEN",
      })
      .returning({ id: reports.id });

    if (!row) {
      return reportFailure("DB_ERROR");
    }

    return reportSuccess(row.id, true);
  } catch (error: unknown) {
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === "23505") {
      const duplicate = await findOpenDuplicateReport(input);
      if (duplicate) {
        return reportSuccess(duplicate.id, false);
      }
    }
    if (pgCode === "23503") {
      return reportFailure("MISSING_PROFILE");
    }
    return reportFailure("DB_ERROR");
  }
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
