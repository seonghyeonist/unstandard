export const CLOSED_ALPHA_TERMS_VERSION = "closed-alpha-terms-v1" as const;
export const CLOSED_ALPHA_SAFETY_RULES_VERSION = "closed-alpha-safety-v1" as const;

export type RegistrationLegalSelection = {
  adultConfirmed: true;
  termsAccepted: true;
  safetyRulesAccepted: true;
  termsVersion: typeof CLOSED_ALPHA_TERMS_VERSION;
  safetyRulesVersion: typeof CLOSED_ALPHA_SAFETY_RULES_VERSION;
};

export type RegistrationLegalAcceptance = RegistrationLegalSelection & {
  acceptedAt: string;
};

/**
 * Validate the small, versioned contract collected before an invite is
 * consumed. Privacy is intentionally not included here: the privacy notice
 * is a disclosure document, while these are affirmative Stage-1 gates.
 */
export function parseRegistrationLegalSelection(
  input: unknown,
): RegistrationLegalSelection | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  if (
    value.adultConfirmed !== true ||
    value.termsAccepted !== true ||
    value.safetyRulesAccepted !== true ||
    value.termsVersion !== CLOSED_ALPHA_TERMS_VERSION ||
    value.safetyRulesVersion !== CLOSED_ALPHA_SAFETY_RULES_VERSION
  ) {
    return null;
  }

  return {
    adultConfirmed: true,
    termsAccepted: true,
    safetyRulesAccepted: true,
    termsVersion: CLOSED_ALPHA_TERMS_VERSION,
    safetyRulesVersion: CLOSED_ALPHA_SAFETY_RULES_VERSION,
  };
}

export function createRegistrationLegalAcceptance(
  selection: RegistrationLegalSelection,
  acceptedAt = new Date().toISOString(),
): RegistrationLegalAcceptance {
  return {
    ...selection,
    acceptedAt,
  };
}

export function isRegistrationLegalAcceptance(
  input: unknown,
): input is RegistrationLegalAcceptance {
  if (!input || typeof input !== "object") return false;

  const value = input as Record<string, unknown>;
  if (!parseRegistrationLegalSelection(value)) return false;
  if (typeof value.acceptedAt !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.acceptedAt)) {
    return false;
  }

  const parsed = Date.parse(value.acceptedAt);
  return Number.isFinite(parsed) && parsed <= Date.now();
}
