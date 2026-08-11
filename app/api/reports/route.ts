import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { privateJson } from "@/lib/http/private-json";
import { isReportsPersistenceEnabled } from "@/lib/config/persistence-mode";
import { validateReportForUser } from "@/lib/security/report-validation";
import { ensureReporterProfile } from "@/lib/server/profile/profile-bootstrap";
import { mapReporterProfileFailure } from "@/lib/server/profile/profile-bootstrap.http-mapper";
import { createReportHttpResponse } from "@/lib/server/persistence/reports.http";
import { createReportsRepository } from "@/lib/server/persistence/reports.repository.factory";
import { consumeRateLimit, RateLimitUnavailableError } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Authentication service unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decision = await consumeRateLimit({ scope: "reportCreate", subject: user.id });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Report service unavailable" }, { status: 503 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  try {
    let reporterProfileId: string | undefined;
    if (isReportsPersistenceEnabled()) {
      const reporterProfile = await ensureReporterProfile(user);
      if (!reporterProfile.ok) {
        const failure = mapReporterProfileFailure(reporterProfile);
        return privateJson(failure.body, { status: failure.status });
      }
      reporterProfileId = reporterProfile.profileId;
    }

    const validated = validateReportForUser(
      {
        targetType: String(input.targetType ?? ""),
        targetId: String(input.targetId ?? ""),
        reason: String(input.reason ?? ""),
        reporterUserId: input.reporterUserId as string | undefined,
      },
      user.id,
      reporterProfileId,
    );

    const repository = createReportsRepository();
    const result = await repository.createOrGetOpenReport({
      reporterUserId: user.id,
      targetType: validated.targetType,
      targetId: validated.targetId,
      reason: validated.reason,
    });

    return createReportHttpResponse(result);
  } catch {
    // Validation errors are intentionally generic; database/provider details
    // must never be reflected to an authenticated client.
    return privateJson({ error: "Invalid report" }, { status: 400 });
  }
}
