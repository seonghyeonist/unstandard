import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthEnvDiagnostics } from "@/lib/debug/auth-env-diagnostics";

function isAuthorizedDebugRequest(request: Request): boolean {
  const expected = process.env.UNSTANDARD_DEBUG_CHECK_TOKEN?.trim();
  if (!expected) return false;

  const url = new URL(request.url);
  const provided = url.searchParams.get("token");
  if (!provided) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function notFound(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedDebugRequest(request)) {
    return notFound();
  }

  const body = buildAuthEnvDiagnostics(request);
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
