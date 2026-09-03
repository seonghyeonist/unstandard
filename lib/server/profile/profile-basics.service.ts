import "server-only";
import { profileBasicsSchema } from "@/lib/profile/basics";
import { identityRepository } from "@/lib/db/repositories/identity.repository";
import { profileBasicsRepository } from "@/lib/db/repositories/profile-basics.repository";
import { getIdentityProvider } from "@/lib/server/identity/provider";

async function purgeIdentityBeforeProfileMutation(userId: string): Promise<void> {
  const current = await identityRepository.findCurrent(userId);
  if (!current?.providerReference || current.status === "verified") return;
  const provider = getIdentityProvider();
  if (!provider || !await provider.purge({ requestId: current.requestId, providerReference: current.providerReference })) {
    throw new Error("Identity provider purge is pending");
  }
}

export async function readProfileSetup(userId: string) {
  return { ...await profileBasicsRepository.read(userId), verificationAvailable: getIdentityProvider() !== null };
}
export async function saveProfileBasics(userId: string, input: unknown) {
  const parsed = profileBasicsSchema.parse(input);
  await purgeIdentityBeforeProfileMutation(userId);
  await profileBasicsRepository.save(userId, parsed);
}
export async function withdrawProfileBasics(userId: string) {
  await purgeIdentityBeforeProfileMutation(userId);
  await profileBasicsRepository.withdraw(userId);
}
