import "server-only";
import type { IdentityLogEvent } from "@/lib/identity/contracts";

const SAFE_CODE = /^[A-Z0-9_.-]{1,80}$/u;
const SAFE_EVENT = /^identity\.[a-z0-9_.-]{1,100}$/u;

/**
 * Identity diagnostics are deliberately allow-listed and contain no request
 * IDs, account identifiers, provider bodies, IP addresses or error text.
 */
export function logIdentityEvent(fields: IdentityLogEvent): void {
  const providerStatus = fields.providerStatus;
  const durationMs = fields.durationMs;
  const payload = {
    event: SAFE_EVENT.test(fields.event) ? fields.event : "identity.invalid_event",
    stage: fields.stage,
    status: fields.status,
    code: SAFE_CODE.test(fields.code) ? fields.code : "UNSAFE_CODE",
    ...(typeof providerStatus === "number" && Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599
      ? { providerStatus }
      : {}),
    ...(typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? { durationMs: Math.round(durationMs) }
      : {}),
  };
  try {
    const line = JSON.stringify(payload);
    if (fields.status === "error") console.error(line);
    else console.info(line);
  } catch {
    // Diagnostics must never break authentication or identity flows.
  }
}
