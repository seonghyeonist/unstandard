const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serializedResponseHasSensitiveFields(body: unknown): boolean {
  const serialized = JSON.stringify(body ?? {});
  return (
    EMAIL_PATTERN.test(serialized) ||
    /\"email\"\s*:/.test(serialized) ||
    /\"token\"\s*:/.test(serialized) ||
    UUID_PATTERN.test(serialized)
  );
}

export function sessionResponseHasSensitiveFields(body: unknown): boolean {
  return serializedResponseHasSensitiveFields(body);
}

/**
 * Private-profile responses intentionally expose a top-level correlationId
 * for operator tracing. Exclude only that validated trace ID before applying
 * the same strict email/token/UUID scan to the actual private payload.
 */
export function privateProfileResponseHasSensitiveFields(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;

  const { correlationId, ...payload } = body as Record<string, unknown>;
  if (typeof correlationId !== "string" || !CORRELATION_ID_PATTERN.test(correlationId)) {
    return true;
  }

  return serializedResponseHasSensitiveFields(payload);
}
