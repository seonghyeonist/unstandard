import type { ReporterProfileResult } from "@/lib/server/profile/profile.types";

export const REPORTER_PROFILE_SETUP_ERROR = "Profile setup required before reporting";

/** Maps bootstrap failure to HTTP 409 payload — no DB internals. */
export function mapReporterProfileFailure(
  result: Extract<ReporterProfileResult, { ok: false }>,
): { status: 409; body: { error: string } } {
  if (result.code === "SETUP_REQUIRED") {
    return { status: 409, body: { error: REPORTER_PROFILE_SETUP_ERROR } };
  }

  return { status: 409, body: { error: REPORTER_PROFILE_SETUP_ERROR } };
}
