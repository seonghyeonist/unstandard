import { z } from "zod";
import {
  identityLaunchSchema,
  identityProviderReferenceSchema,
  identityRequestIdSchema,
  type IdentityProvider,
} from "@/lib/identity/contracts";
import { readSmallJson } from "@/lib/http/profile-request";

const DIDIT_API_ORIGIN = "https://verification.didit.me";
const DIDIT_HOSTED_ORIGIN = "https://verify.didit.me";
const DIDIT_REQUEST_TIMEOUT_MS = 8_000;

const configSchema = z.object({
  enabled: z.literal("true"),
  apiKey: z.string().trim().min(1).max(4096).regex(/^\S+$/),
  workflowId: z.string().uuid(),
  callbackUrl: z.string().url().refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Didit callback must use HTTPS"),
  webhookSecret: z.string().trim().min(1).max(4096).regex(/^\S+$/).optional(),
});

export type DiditIdentityConfig = z.infer<typeof configSchema>;

/** Pure parser; the publication/contract gate belongs to the server factory. */
export function parseDiditIdentityConfig(env: Record<string, string | undefined>): DiditIdentityConfig | null {
  const appUrl = env.UNSTANDARD_APP_URL?.trim() || env.BETTER_AUTH_URL?.trim();
  let callbackUrl: string | undefined;
  if (appUrl) {
    try {
      callbackUrl = new URL("/api/identity/return", appUrl).toString();
    } catch {
      callbackUrl = undefined;
    }
  }
  const parsed = configSchema.safeParse({
    enabled: env.UNSTANDARD_IDENTITY_ENABLED,
    apiKey: env.DIDIT_API_KEY,
    workflowId: env.DIDIT_WORKFLOW_ID,
    callbackUrl,
    webhookSecret: env.DIDIT_WEBHOOK_SECRET,
  });
  return parsed.success ? parsed.data : null;
}

const providerResponseId = identityProviderReferenceSchema;
const featureResultSchema = z.object({ status: z.string().trim().min(1).max(64) }).passthrough();
const idVerificationSchema = featureResultSchema.extend({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const decisionSchema = z.object({
  session_id: providerResponseId,
  session_kind: z.literal("user"),
  workflow_id: z.string().uuid(),
  vendor_data: identityRequestIdSchema,
  status: z.literal("Approved"),
  features: z.array(z.union([z.string(), z.object({ feature: z.string() }).passthrough()])),
  id_verifications: z.array(idVerificationSchema).min(1),
  liveness_checks: z.array(featureResultSchema).min(1),
  face_matches: z.array(featureResultSchema).min(1),
  ip_analyses: z.array(featureResultSchema).min(1),
}).passthrough();

const createSessionSchema = z.object({
  session_id: providerResponseId,
  url: z.string().url(),
}).passthrough();

const deleteSessionSchema = z.object({
  session_id: providerResponseId,
  face_retention_outcome: z.enum(["deleted", "retained_with_user", "none", "ineligible_no_vendor_user"]),
  biometric_template_uuid: identityProviderReferenceSchema.nullable(),
}).passthrough();

const REQUIRED_FEATURES = ["ID_VERIFICATION", "LIVENESS", "FACE_MATCH", "IP_ANALYSIS"] as const;

function diditSessionUrl(providerReference: string, suffix: "decision/" | "delete/"): string | null {
  if (!identityProviderReferenceSchema.safeParse(providerReference).success) return null;
  return `${DIDIT_API_ORIGIN}/v3/session/${encodeURIComponent(providerReference)}/${suffix}`;
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(DIDIT_REQUEST_TIMEOUT_MS);
}

function isApproved(status: string): boolean {
  return status === "Approved";
}

function isAdultAt(dateOfBirth: string, at: Date): boolean {
  if (!Number.isFinite(at.getTime())) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month - 1 || dob.getUTCDate() !== day) return false;
  if (dob > at) return false;
  let age = at.getUTCFullYear() - year;
  const birthdayNotReached = at.getUTCMonth() + 1 < month ||
    (at.getUTCMonth() + 1 === month && at.getUTCDate() < day);
  if (birthdayNotReached) age -= 1;
  return age >= 19;
}

function featureNames(features: Array<string | { feature: string }>): string[] {
  return features.map((feature) => typeof feature === "string" ? feature : feature.feature);
}

function hasExactWorkflowFeatures(features: Array<string | { feature: string }>): boolean {
  const names = featureNames(features);
  return names.length === REQUIRED_FEATURES.length &&
    REQUIRED_FEATURES.every((feature) => names.includes(feature));
}

/**
 * Didit is deliberately reduced to a provider-neutral proof here. Raw decision
 * data, including document fields and media URLs, never leaves this adapter.
 */
export function createDiditIdentityProvider(
  config: DiditIdentityConfig,
  fetcher: typeof fetch = fetch,
  clock: () => Date = () => new Date(),
): IdentityProvider {
  const headers = {
    "x-api-key": config.apiKey,
    Accept: "application/json",
  };

  return {
    id: "didit-v3",
    async start({ requestId }) {
      if (!identityRequestIdSchema.safeParse(requestId).success) throw new Error("Invalid request");
      const response = await fetcher(`${DIDIT_API_ORIGIN}/v3/session/`, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: requestSignal(),
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: config.workflowId,
          vendor_data: requestId,
          callback: config.callbackUrl,
          callback_method: "both",
          language: "ko",
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Didit session creation failed");
      }
      const parsed = createSessionSchema.safeParse(await readSmallJson(response, 32 * 1024));
      if (!parsed.success) throw new Error("Invalid Didit session response");
      return identityLaunchSchema.parse({
        type: "didit",
        providerReference: parsed.data.session_id,
        url: parsed.data.url,
      });
    },
    async verify({ requestId, providerReference }) {
      const url = diditSessionUrl(providerReference, "decision/");
      if (!url || !identityRequestIdSchema.safeParse(requestId).success) return null;
      try {
        const response = await fetcher(url, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          signal: requestSignal(),
          headers,
        });
        if (!response.ok) {
          await response.body?.cancel();
          return null;
        }
        const parsed = decisionSchema.safeParse(await readSmallJson(response, 256 * 1024));
        if (!parsed.success || parsed.data.session_id !== providerReference ||
          parsed.data.vendor_data !== requestId || parsed.data.workflow_id !== config.workflowId ||
          !hasExactWorkflowFeatures(parsed.data.features)) return null;

        const idVerified = parsed.data.id_verifications.some((item) => isApproved(item.status));
        const livenessVerified = parsed.data.liveness_checks.some((item) => isApproved(item.status));
        const faceMatchVerified = parsed.data.face_matches.some((item) => isApproved(item.status));
        const deviceIpVerified = parsed.data.ip_analyses.some((item) => isApproved(item.status));
        const verifiedAt = clock();
        const idWithAdult = parsed.data.id_verifications.find((item) => isApproved(item.status) && isAdultAt(item.date_of_birth, verifiedAt));
        if (!idVerified || !livenessVerified || !faceMatchVerified || !deviceIpVerified || !idWithAdult) return null;

        return {
          requestId,
          providerReference,
          verifiedAt,
          documentVerified: true,
          livenessVerified: true,
          faceMatchVerified: true,
          deviceIpVerified: true,
          adultVerified: true,
        };
      } catch {
        // Provider errors/raw responses must never enter logs, traces or UI errors.
        return null;
      }
    },
    async purge({ requestId, providerReference }) {
      const url = diditSessionUrl(providerReference, "delete/");
      if (!url || !identityRequestIdSchema.safeParse(requestId).success) return false;
      try {
        const response = await fetcher(url, {
          method: "DELETE",
          cache: "no-store",
          redirect: "error",
          signal: requestSignal(),
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            retain_face_embeddings: false,
            deletion_instruction: "operational_session_delete",
            instruction_id: requestId,
          }),
        });
        if (response.status !== 200) {
          await response.body?.cancel();
          return false;
        }
        const parsed = deleteSessionSchema.safeParse(await readSmallJson(response, 32 * 1024));
        return parsed.success && parsed.data.session_id === providerReference &&
          (parsed.data.face_retention_outcome === "deleted" || parsed.data.face_retention_outcome === "none") &&
          parsed.data.biometric_template_uuid === null;
      } catch {
        return false;
      }
    },
  };
}

export const diditApiOrigin = DIDIT_API_ORIGIN;
export const diditHostedOrigin = DIDIT_HOSTED_ORIGIN;
