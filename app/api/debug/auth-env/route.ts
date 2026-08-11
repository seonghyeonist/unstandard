import { NextResponse } from "next/server";
import { buildAuthEnvDiagnostics } from "@/lib/debug/auth-env-diagnostics";
import { isAuthorizedOperatorRequest } from "@/lib/security/operator-token";

export function isAuthorizedDebugRequest(request: Request): boolean {
  return isAuthorizedOperatorRequest(request);
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
