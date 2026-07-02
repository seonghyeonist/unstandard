import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isAnswersPersistenceEnabled } from "@/lib/config/answers-persistence-mode";

export type ProfileSessionFields = {
  nickname?: string;
  onboarded: boolean;
};

/**
 * Loads profile session fields when answers persistence is enabled.
 * Returns onboarded=false when profile row or onboarded_at is missing.
 */
export async function loadProfileSessionFields(userId: string): Promise<ProfileSessionFields | null> {
  if (!isAnswersPersistenceEnabled()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("nickname, onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { onboarded: false };
  }

  return {
    nickname: typeof data.nickname === "string" ? data.nickname : undefined,
    onboarded: Boolean(data.onboarded_at),
  };
}
