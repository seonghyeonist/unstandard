import { NextResponse } from "next/server";
import { mapCreateReportResultToHttp } from "@/lib/server/persistence/reports.http-mapper";
import type { CreateReportResult } from "@/lib/server/persistence/reports.types";

/** Maps repository result codes to HTTP responses — no database-specific details. */
export function createReportHttpResponse(result: CreateReportResult): NextResponse {
  const mapped = mapCreateReportResultToHttp(result);
  return NextResponse.json(mapped.body, { status: mapped.status });
}
