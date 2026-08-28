import "server-only";
import { profileBasicsSchema } from "@/lib/profile/basics";
import { profileBasicsRepository } from "@/lib/db/repositories/profile-basics.repository";
import { getIdentityProvider } from "@/lib/server/identity/provider";
export async function readProfileSetup(userId: string) {
  return { ...await profileBasicsRepository.read(userId), verificationAvailable: getIdentityProvider() !== null };
}
export async function saveProfileBasics(userId: string, input: unknown) {
  await profileBasicsRepository.save(userId, profileBasicsSchema.parse(input));
}
export async function withdrawProfileBasics(userId: string) { await profileBasicsRepository.withdraw(userId); }
