import type { CreateReportInput, CreateReportResult } from "@/lib/server/persistence/reports.types";

/** Replaceable persistence boundary — routes depend on this interface only. */
export interface ReportsRepository {
  createOrGetOpenReport(input: CreateReportInput): Promise<CreateReportResult>;
}
