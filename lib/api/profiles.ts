import { publicProfiles } from "@/lib/data/mock-public";
import type { ProfilePrivate, PublicProfile } from "@/types/profile";

export async function getProfile(profileId: string): Promise<PublicProfile> {
  try {
    const response = await fetch(`/api/profile/${profileId}`, { credentials: "include" });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // fall through to mock for local-only ids
  }

  const profile = publicProfiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("Profile not found");
  return profile;
}

export async function getPrivateProfile(profileId: string): Promise<ProfilePrivate> {
  const response = await fetch(`/api/profile/${profileId}/private`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Private profile unavailable (${response.status})`);
  }
  return response.json();
}
