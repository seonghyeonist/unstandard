import { parseDiditIdentityConfig } from "@/lib/identity/didit";

export const IDENTITY_READINESS_CODES = [
  "NOTICE_NOT_READY",
  "ENV_DISABLED",
  "CONFIG_INCOMPLETE",
  "INVALID_APP_ORIGIN",
  "WEBHOOK_NOT_CONFIGURED",
  "READY",
] as const;

export type IdentityReadinessCode = (typeof IDENTITY_READINESS_CODES)[number];

/**
 * Classifies provider readiness without returning credentials or provider
 * configuration. This is intentionally pure so the release policy can be
 * tested without importing server-only modules.
 */
export function classifyIdentityReadiness(
  env: Record<string, string | undefined>,
  noticeReady: boolean,
): IdentityReadinessCode {
  if (!noticeReady) return "NOTICE_NOT_READY";
  if (env.UNSTANDARD_IDENTITY_ENABLED !== "true") return "ENV_DISABLED";

  const appUrl = env.UNSTANDARD_APP_URL?.trim() || env.BETTER_AUTH_URL?.trim();
  if (!appUrl) return "CONFIG_INCOMPLETE";
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return "INVALID_APP_ORIGIN";
    }
  } catch {
    return "INVALID_APP_ORIGIN";
  }

  const config = parseDiditIdentityConfig(env);
  if (!config) return "CONFIG_INCOMPLETE";
  if (!config.webhookSecret) return "WEBHOOK_NOT_CONFIGURED";
  return "READY";
}

export function publicIdentityAvailabilityReason(
  code: IdentityReadinessCode,
): "not_ready" | "temporarily_unavailable" | null {
  if (code === "READY") return null;
  if (code === "NOTICE_NOT_READY" || code === "ENV_DISABLED") return "not_ready";
  return "temporarily_unavailable";
}
