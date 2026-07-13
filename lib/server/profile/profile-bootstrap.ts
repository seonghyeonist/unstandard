import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/server";
import { isReportsPersistenceEnabled } from "@/lib/config/persistence-mode";
import { ensureProfileForUser } from "@/lib/db/repositories/profile-bootstrap";
import {
  reporterProfileSetupRequired,
  reporterProfileSuccess,
  type ReporterProfileResult,
} from "@/lib/server/profile/profile.types";

export async function ensureReporterProfile(
  user: AuthenticatedUser,
): Promise<ReporterProfileResult> {
  if (!isReportsPersistenceEnabled()) {
    return reporterProfileSuccess(user.id);
  }

  try {
    const profile = await ensureProfileForUser(user);
    return reporterProfileSuccess(profile.profileId);
  } catch {
    return reporterProfileSetupRequired();
  }
}

export type { ReporterProfileResult };
