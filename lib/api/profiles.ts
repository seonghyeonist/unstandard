import { profiles } from "@/lib/api/mock-data";
import type { Profile } from "@/types/profile";

export async function getProfile(profileId: string): Promise<Profile> {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("Profile not found");
  return profile;
}
