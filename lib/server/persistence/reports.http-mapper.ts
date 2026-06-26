import type { CreateReportResult } from "@/lib/server/persistence/reports.types";

export type ReportHttpResponsePayload =
  | { status: 201 | 200; body: { ok: true; id: string } }
  | { status: 503; body: { error: string } }
  | { status: 409; body: { error: string } }
  | { status: 500; body: { error: string } };

/** Pure HTTP mapping — testable without Next.js runtime. */
export function mapCreateReportResultToHttp(
  result: CreateReportResult,
): ReportHttpResponsePayload {
  if (result.ok) {
    return {
      status: result.inserted ? 201 : 200,
      body: { ok: true, id: result.reportId },
    };
  }

  switch (result.code) {
    case "PERSISTENCE_DISABLED":
      return { status: 503, body: { error: "Report persistence unavailable" } };
    case "MISSING_PROFILE":
      return {
        status: 409,
        body: { error: "Profile setup required before reporting" },
      };
    case "DB_ERROR":
      return { status: 500, body: { error: "Report submission failed" } };
  }
}
