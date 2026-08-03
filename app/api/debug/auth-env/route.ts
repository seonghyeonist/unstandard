import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthEnvDiagnostics } from "@/lib/debug/auth-env-diagnostics";

export function isAuthorizedDebugRequest(request: Request): boolean {
  const expected = process.env.UNSTANDARD_DEBUG_CHECK_TOKEN?.trim();
  if (!expected) return false;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  const provided = match?.[1]?.trim();
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
