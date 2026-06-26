import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { isReportsPersistenceEnabled } from "@/lib/config/persistence-mode";
import { validateReportForUser } from "@/lib/security/report-validation";
import { ensureReporterProfile } from "@/lib/server/profile/profile-bootstrap";
import { mapReporterProfileFailure } from "@/lib/server/profile/profile-bootstrap.http-mapper";
import { createReportHttpResponse } from "@/lib/server/persistence/reports.http";
import { createReportsRepository } from "@/lib/server/persistence/reports.repository.factory";

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

    let reporterUserId = user.id;
    if (isReportsPersistenceEnabled()) {
      const reporterProfile = await ensureReporterProfile(user);
      if (!reporterProfile.ok) {
        const failure = mapReporterProfileFailure(reporterProfile);
        return NextResponse.json(failure.body, { status: failure.status });
      }
      reporterUserId = reporterProfile.profileId;
    }

    const repository = createReportsRepository();
    const result = await repository.createOrGetOpenReport({
      reporterUserId,
      targetType: validated.targetType,
      targetId: validated.targetId,
      reason: validated.reason,
    });

    return createReportHttpResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
