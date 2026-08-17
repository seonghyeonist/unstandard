import { z } from "zod";
import type { AlphaAcquisitionChannel } from "@/lib/alpha/stage1-policy";
import { normalizeEmail } from "@/lib/auth/invite-crypto";

export type WaitlistJoinInput = {
  email: string;
  acquisitionChannel: AlphaAcquisitionChannel;
};

const emailSchema = z.string().trim().email().max(320);

export function validateWaitlistJoin(value: unknown): WaitlistJoinInput {
  if (!value || typeof value !== "object") throw new Error("INVALID_WAITLIST_INPUT");
  const input = value as Record<string, unknown>;
  if (input.consent !== true) throw new Error("CONSENT_REQUIRED");
  const email = normalizeEmail(emailSchema.parse(input.email));
  if (input.acquisitionChannel !== undefined && input.acquisitionChannel !== "organic") {
    throw new Error("UNTRUSTED_ACQUISITION_CHANNEL");
  }
  return { email, acquisitionChannel: "organic" };
}
