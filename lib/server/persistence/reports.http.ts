import { mapCreateReportResultToHttp } from "@/lib/server/persistence/reports.http-mapper";
import type { CreateReportResult } from "@/lib/server/persistence/reports.types";
import { privateJson } from "@/lib/http/private-json";

/** Maps repository result codes to HTTP responses — no database-specific details. */
export function createReportHttpResponse(result: CreateReportResult) {
  const mapped = mapCreateReportResultToHttp(result);
  return privateJson(mapped.body, { status: mapped.status });
}
