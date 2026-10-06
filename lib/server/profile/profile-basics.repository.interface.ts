import type { ProfileBasicsInput, ProfileSetupView } from "@/lib/profile/basics";

export class IdentityInProgressError extends Error {
  constructor() {
    super("Identity verification is in progress");
    this.name = "IdentityInProgressError";
  }
}

export interface ProfileBasicsRepository {
  read(userId: string): Promise<Omit<ProfileSetupView, "verificationAvailable" | "verificationAvailabilityReason">>;
  save(userId: string, input: ProfileBasicsInput): Promise<void>;
  withdraw(userId: string): Promise<void>;
}
