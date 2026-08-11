import {
  CANONICAL_MAIN_BRANCH_ALIAS_HOSTNAME,
  CANONICAL_PRODUCTION_HOSTNAME,
} from "./proof-constants";

export type HostnameValidationFailure =
  | "empty"
  | "url_not_hostname"
  | "localhost"
  | "production_alias"
  | "main_branch_alias"
  | "not_vercel_app"
  | "unexpected_preview";

/**
 * Extract a bare hostname from an operator-supplied URL or hostname string.
 * Rejects secret-bearing query strings by returning hostname only after parse.
 * Does not authorize; hostname equality alone does not prove deployment SHA.
 */
export function extractHostname(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes("://") || trimmed.includes("/") || trimmed.includes("?")) {
    try {
      const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      return url.hostname.toLowerCase() || null;
    } catch {
      return null;
    }
  }

  if (trimmed.includes("@") || trimmed.includes(" ") || trimmed.includes(":")) {
    // Reject userinfo/port/secret-ish forms; port is not a Preview hostname.
    if (/^[a-z0-9.-]+$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return null;
  }

  if (!/^[a-z0-9.-]+$/i.test(trimmed)) {
    return null;
  }

  return trimmed.toLowerCase();
}

export function validateEvidenceHostname(
  hostname: string,
  options?: { expectedPreviewHostname?: string },
): HostnameValidationFailure | null {
  const host = hostname.trim().toLowerCase();
  if (!host) return "empty";

  if (host.includes("://") || host.includes("/") || host.includes("?") || host.includes("@")) {
    return "url_not_hostname";
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    return "localhost";
  }

  if (host === CANONICAL_PRODUCTION_HOSTNAME) {
    return "production_alias";
  }

  if (host === CANONICAL_MAIN_BRANCH_ALIAS_HOSTNAME) {
    return "main_branch_alias";
  }

  if (!host.endsWith(".vercel.app")) {
    return "not_vercel_app";
  }

  const expected = options?.expectedPreviewHostname?.trim().toLowerCase();
  if (expected && host !== expected) {
    return "unexpected_preview";
  }

  return null;
}

export function hostnameFailureMessage(failure: HostnameValidationFailure): string {
  switch (failure) {
    case "empty":
      return "preview hostname is missing";
    case "url_not_hostname":
      return "previewHostname must be a bare hostname, not a URL or secret-bearing string";
    case "localhost":
      return "localhost is not valid Preview evidence";
    case "production_alias":
      return "Production hostname cannot be used as Preview proof";
    case "main_branch_alias":
      return "main-branch alias cannot be used as PR Preview proof";
    case "not_vercel_app":
      return "preview hostname must end in .vercel.app";
    case "unexpected_preview":
      return "preview hostname does not match UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME";
    default: {
      const _exhaustive: never = failure;
      return _exhaustive;
    }
  }
}
