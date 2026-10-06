import "server-only";
import { profileBasicsSchema } from "@/lib/profile/basics";
import { identityRepository } from "@/lib/db/repositories/identity.repository";
import { profileBasicsRepository } from "@/lib/db/repositories/profile-basics.repository";
import { getIdentityProvider, getIdentityReadiness } from "@/lib/server/identity/provider";

async function purgeIdentityBeforeExplicitWithdrawal(userId: string): Promise<void> {
  const current = await identityRepository.findCurrent(userId);
  if (!current?.providerReference || current.status === "verified") return;
  const provider = getIdentityProvider();
  if (!provider || !await provider.purge({ requestId: current.requestId, providerReference: current.providerReference, deletionInstruction: "privacy_erasure" })) {
    throw new Error("Identity provider purge is pending");
  }
}

export async function readProfileSetup(userId: string) {
  const readiness = getIdentityReadiness();
  return {
    ...await profileBasicsRepository.read(userId),
    verificationAvailable: readiness.available,
    verificationAvailabilityReason: readiness.publicReason ?? undefined,
  };
}
export async function saveProfileBasics(userId: string, input: unknown) {
  const parsed = profileBasicsSchema.parse(input);
  // Profile saves never cancel or purge identity requests implicitly. The repository
  // preserves no-op saves and rejects material changes while a request is active.
  await profileBasicsRepository.save(userId, parsed);
}
export async function withdrawProfileBasics(userId: string) {
  await purgeIdentityBeforeExplicitWithdrawal(userId);
  await profileBasicsRepository.withdraw(userId);
}
