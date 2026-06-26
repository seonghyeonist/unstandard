import "server-only";

import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/server";
import { isReportsPersistenceEnabled } from "@/lib/config/persistence-mode";
import { ensureReporterProfileSupabase } from "@/lib/server/profile/adapters/supabase/reporter-profile.bootstrap";
import {
  reporterProfileSuccess,
  type ReporterProfileResult,
} from "@/lib/server/profile/profile.types";

/**
 * Ensures a reporter profile row exists before reports persistence (alpha adapter path).
 * When reports persistence is disabled, returns auth user id without touching DB.
 */
export async function ensureReporterProfile(
  user: AuthenticatedUser,
): Promise<ReporterProfileResult> {
  if (!isReportsPersistenceEnabled()) {
    return reporterProfileSuccess(user.id);
  }

  return ensureReporterProfileSupabase(user);
}

export type { ReporterProfileResult };
