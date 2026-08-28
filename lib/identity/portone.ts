import { z } from "zod";
import { identityLaunchSchema, identityRequestIdSchema, type IdentityProvider } from "@/lib/identity/contracts";
import { readSmallJson } from "@/lib/http/profile-request";

const configSchema = z.object({
  enabled: z.literal("true"),
  storeId: identityLaunchSchema.shape.storeId,
  channelKey: identityLaunchSchema.shape.channelKey,
  apiSecret: z.string().min(1).max(4096).regex(/^\S+$/),
});
export type PortOneIdentityConfig = z.infer<typeof configSchema>;

/** Pure parser; env reads and the publication/contract gate belong to the server factory. */
export function parsePortOneIdentityConfig(env: Record<string, string | undefined>): PortOneIdentityConfig | null {
  const parsed = configSchema.safeParse({
    enabled: env.UNSTANDARD_IDENTITY_ENABLED,
    storeId: env.PORTONE_STORE_ID,
    channelKey: env.PORTONE_IDENTITY_CHANNEL_KEY,
    apiSecret: env.PORTONE_API_SECRET,
  });
  return parsed.success ? parsed.data : null;
}

// Strip unneeded fields (CI/DI/DOB/phone/pgRawResponse) immediately; never persist or log the response.
const verifiedSchema = z.object({
  status: z.literal("VERIFIED"), version: z.literal("V2"), id: identityRequestIdSchema,
  channel: z.object({ type: z.literal("LIVE"), key: z.string(), pgProvider: z.literal("DANAL") }),
  verifiedCustomer: z.object({ name: z.string().trim().min(1).max(256) }),
  verifiedAt: z.string().datetime({ offset: true }),
});

/** PortOne V2 canonical lookup, restricted to the contracted LIVE Danal phone-identity channel.
 * VERIFIED on this channel certifies name and own-name phone authentication. phoneNumber is
 * an optional, separately contracted return field; do not request it just to retain a number.
 * This is not a generic SMS OTP adapter or an identity-certificate adapter.
 */
export function createPortOneIdentityProvider(config: PortOneIdentityConfig, fetcher: typeof fetch = fetch): IdentityProvider {
  return {
    id: "portone-v2-danal",
    async start({ requestId }) {
      return identityLaunchSchema.parse({ type: "portone", storeId: config.storeId,
        channelKey: config.channelKey, identityVerificationId: requestId });
    },
    async verify(requestId) {
      if (!identityRequestIdSchema.safeParse(requestId).success) return null;
      const url = new URL(`https://api.portone.io/identity-verifications/${encodeURIComponent(requestId)}`);
      // Store binding is a query parameter in the official API, not a response field.
      url.searchParams.set("storeId", config.storeId);
      try {
        const response = await fetcher(url, { method: "GET", cache: "no-store", redirect: "error",
          signal: AbortSignal.timeout(8000), headers: { Authorization: `PortOne ${config.apiSecret}`, Accept: "application/json" } });
        if (!response.ok) { await response.body?.cancel(); return null; }
        // The byte cap also applies to chunked responses and the timeout covers body consumption.
        const proof = verifiedSchema.safeParse(await readSmallJson(response, 64 * 1024));
        if (!proof.success || proof.data.id !== requestId || proof.data.channel.key !== config.channelKey) return null;
        return { requestId, verifiedAt: new Date(proof.data.verifiedAt), realNameMatched: true, phoneOwnershipVerified: true };
      } catch {
        // Provider errors/raw response/Authorization must never enter logs, traces or UI errors.
        return null;
      }
    },
  };
}
