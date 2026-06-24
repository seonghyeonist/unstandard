import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { validateReportForUser } from "@/lib/security/report-validation";
import {
  createOrGetOpenReport,
  isPersistenceNotConfiguredError,
} from "@/lib/server/persistence/reports.repository";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  try {
    const validated = validateReportForUser(
      {
        targetType: String(input.targetType ?? ""),
        targetId: String(input.targetId ?? ""),
        reason: String(input.reason ?? ""),
        reporterUserId: input.reporterUserId as string | undefined,
      },
      user.id,
    );

    const { record, created } = await createOrGetOpenReport({
      reporterUserId: user.id,
      targetType: validated.targetType,
      targetId: validated.targetId,
      reason: validated.reason,
    });

    return NextResponse.json({ ok: true, id: record.id }, { status: created ? 201 : 200 });
  } catch (error) {
    if (isPersistenceNotConfiguredError(error)) {
      return NextResponse.json({ error: "Report persistence unavailable" }, { status: 503 });
    }

    if (error instanceof Error) {
      const message = error.message;
      if (message === "Report lookup failed" || message === "Report create failed") {
        return NextResponse.json({ error: "Report submission failed" }, { status: 500 });
      }
      if (message === "Reporter profile required") {
        return NextResponse.json({ error: "Profile setup required before reporting" }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
}
