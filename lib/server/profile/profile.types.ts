/** Backend-agnostic reporter profile bootstrap result — no Supabase types. */
export type ReporterProfileResult =
  | { ok: true; profileId: string }
  | { ok: false; code: "SETUP_REQUIRED" };

export function reporterProfileSuccess(profileId: string): ReporterProfileResult {
  return { ok: true, profileId };
}

export function reporterProfileSetupRequired(): ReporterProfileResult {
  return { ok: false, code: "SETUP_REQUIRED" };
}
