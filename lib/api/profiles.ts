import type { ProfilePrivate, PublicProfile } from "@/types/profile";

export async function getProfile(profileId: string): Promise<PublicProfile> {
  const response = await fetch(`/api/profile/${encodeURIComponent(profileId)}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Profile unavailable (${response.status})`);
  return response.json();
}

export async function getPrivateProfile(profileId: string): Promise<ProfilePrivate> {
  const response = await fetch(`/api/profile/${profileId}/private`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Private profile unavailable (${response.status})`);
  }
  return response.json();
}
