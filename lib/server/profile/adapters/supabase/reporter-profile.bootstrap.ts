import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedUser } from "@/lib/auth/server";
import { resolveReporterNickname } from "@/lib/server/profile/reporter-nickname";
import {
  reporterProfileSetupRequired,
  reporterProfileSuccess,
  type ReporterProfileResult,
} from "@/lib/server/profile/profile.types";

/**
 * Alpha/prototype Supabase adapter — ensures profiles.id = auth.users.id row exists.
 * Not production architecture.
 */
export async function ensureReporterProfileSupabase(
  user: AuthenticatedUser,
): Promise<ReporterProfileResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return reporterProfileSetupRequired();
  }

  if (data) {
    return reporterProfileSuccess(user.id);
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    nickname: resolveReporterNickname(user),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return reporterProfileSuccess(user.id);
    }
    return reporterProfileSetupRequired();
  }

  return reporterProfileSuccess(user.id);
}
