import { z } from "zod";

const naverProfileSchema = z.object({
  resultcode: z.literal("00"),
  response: z.object({
    id: z.string().trim().min(1).max(256),
    email: z.string().trim().email().max(320),
  }).passthrough(),
}).passthrough();

/**
 * Reduce Naver's authenticated profile to the fields needed by the auth
 * boundary. Provider profile fields must not become application profile data.
 */
export function parseNaverProfile(input: unknown): {
  id: string;
  name: "Member";
  email: string;
  emailVerified: false;
} | null {
  const parsed = naverProfileSchema.safeParse(input);
  if (!parsed.success) return null;

  return {
    id: parsed.data.response.id,
    name: "Member",
    email: parsed.data.response.email,
    emailVerified: false,
  };
}
