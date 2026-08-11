import { NextResponse } from "next/server";
import { isAuthorizedDebugRequest } from "@/app/api/debug/auth-env/route";
import { buildSafeDbFingerprint } from "@/lib/debug/db-fingerprint";
import { createCorrelationId, logUnlockEvent } from "@/lib/server/unlock/unlock-logger";

function notFound(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Authenticated operator-only safe DB fingerprint.
 * Never returns DATABASE_URL, password, or raw hostname.
 */
export async function GET(request: Request) {
  if (!isAuthorizedDebugRequest(request)) {
    return notFound();
  }

  const correlationId = createCorrelationId();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL missing", correlationId },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const fingerprint = await buildSafeDbFingerprint(databaseUrl);
    logUnlockEvent({
      event: "fingerprint.ok",
      correlationId,
      stage: "FINGERPRINT",
      status: "ok",
    });
    return NextResponse.json(
      { ...fingerprint, correlationId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    void error;
    return NextResponse.json(
      { ok: false, error: "fingerprint_failed", correlationId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
