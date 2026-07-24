/**
 * Canonical proof-artifact timestamps: exactly `new Date().toISOString()`.
 * Example: 2026-07-14T06:00:00.000Z
 *
 * Artifact Version 1 wire shape is unchanged (timestamp remains a string field).
 * Validation is tightened because no external PASS artifact has been issued yet.
 */

const CANONICAL_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

export function isCanonicalProofTimestamp(value: string): boolean {
  if (!CANONICAL_ISO_RE.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}

export function assertCanonicalProofTimestamp(value: string): string {
  if (!isCanonicalProofTimestamp(value)) {
    throw new Error(
      "timestamp must be canonical UTC ISO-8601 from Date.toISOString() (YYYY-MM-DDTHH:mm:ss.sssZ)",
    );
  }
  return value;
}

export function nowCanonicalProofTimestamp(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString();
}
