import { publicProfiles } from "@/lib/data/mock-public";
import type { PublicProfile } from "@/types/profile";

export async function getProfile(profileId: string): Promise<PublicProfile> {
  const profile = publicProfiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("Profile not found");
  return profile;
}

export async function getPrivateProfile(profileId: string): Promise<import("@/types/profile").ProfilePrivate> {
  const response = await fetch(`/api/profile/${profileId}/private`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Private profile unavailable");
  }
  return response.json();
}
