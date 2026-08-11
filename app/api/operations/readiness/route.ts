import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildProductionReadinessReport,
  observeProductionDatabase,
  snapshotProductionEnvironment,
} from "@/lib/operations/production-readiness";
import { isAuthorizedOperatorRequest } from "@/lib/security/operator-token";

export const dynamic = "force-dynamic";

function notFound(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function logReadiness(fields: {
  correlationId: string;
  status: "ok" | "error";
  code: string;
  durationMs: number;
}): void {
  const line = JSON.stringify({
    event: "operations.production_readiness",
    route: "/api/operations/readiness",
    ...fields,
  });
  if (fields.status === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

/**
 * Read-only operator preflight. It never migrates, seeds, mutates application
 * rows, or returns a connection string, credential, email, or user identifier.
 */
export async function GET(request: Request) {
  if (!isAuthorizedOperatorRequest(request)) {
    return notFound();
  }

  const startedAt = Date.now();
  const correlationId = randomUUID();
  const environment = snapshotProductionEnvironment();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  let database = null;
  if (databaseUrl) {
    try {
      database = await observeProductionDatabase(databaseUrl);
    } catch {
      database = null;
    }
  }

  const report = buildProductionReadinessReport({
    environment,
    database,
    requestUrl: request.url,
  });
  const status = report.ok ? 200 : 503;

  logReadiness({
    correlationId,
    status: report.ok ? "ok" : "error",
    code: report.ok ? "READINESS_PASS" : "READINESS_FAIL",
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    { ...report, correlationId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
