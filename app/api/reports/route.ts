import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { validateReportInput } from "@/lib/security/report-validation";
import { appendServerReport } from "@/lib/server/report-store.server";

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
    const validated = validateReportInput({
      targetType: String(input.targetType ?? ""),
      targetId: String(input.targetId ?? ""),
      reason: String(input.reason ?? ""),
      reporterUserId: input.reporterUserId as string | undefined,
    });

    const record = {
      id: crypto.randomUUID(),
      reporterUserId: user.id,
      targetType: validated.targetType,
      targetId: validated.targetId,
      reason: validated.reason,
      createdAt: new Date().toISOString(),
      status: "OPEN" as const,
    };

    appendServerReport(record);

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
