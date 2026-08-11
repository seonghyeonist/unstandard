import { randomUUID } from "node:crypto";
import { extractPgErrorCode } from "@/lib/db/errors";

export type UnlockLogStage =
  | "AUTH"
  | "INPUT_VALIDATION"
  | "TARGET_LOOKUP"
  | "QUESTION_LOOKUP"
  | "EVALUATION"
  | "ATTEMPT_INSERT"
  | "UNLOCK_UPSERT"
  | "PRIVATE_AUTHORIZATION"
  | "PRIVATE_FETCH"
  | "CANDIDATE_LIST"
  | "PUBLIC_PROFILE"
  | "FINGERPRINT";

export type UnlockLogFields = {
  event: string;
  correlationId: string;
  stage: UnlockLogStage;
  status: "ok" | "error";
  code?: string;
  viewerUserIdPrefix?: string;
  targetProfileIdPrefix?: string;
  verdict?: string;
  idempotent?: boolean;
  durationMs?: number;
  pgCode?: string;
  constraint?: string;
};

const SENSITIVE_KEY_PATTERN =
  /(answer|email|password|token|cookie|authorization|database_url|letter|private)/i;

export function createCorrelationId(): string {
  return randomUUID();
}

export function idPrefix(value: string | null | undefined, length = 8): string | undefined {
  if (!value) return undefined;
  return value.replace(/-/g, "").slice(0, length);
}

function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 200) return `[redacted:len=${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitizeForLog(nested);
    }
    return out;
  }
  return value;
}

export function logUnlockEvent(fields: UnlockLogFields, extra?: Record<string, unknown>): void {
  const payload = sanitizeForLog({
    ...fields,
    ...(extra ?? {}),
  });
  const line = JSON.stringify(payload);
  if (fields.status === "error") {
    console.error(line);
    return;
  }
  console.info(line);
}

export function extractPgConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    const candidate = (current as { constraint?: unknown }).constraint;
    if (typeof candidate === "string" && candidate.length > 0 && candidate.length < 128) {
      return candidate;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export function logDatabaseFailure(input: {
  correlationId: string;
  stage: UnlockLogStage;
  code: string;
  error: unknown;
  viewerUserIdPrefix?: string;
  targetProfileIdPrefix?: string;
}): void {
  logUnlockEvent({
    event: "unlock.db_error",
    correlationId: input.correlationId,
    stage: input.stage,
    status: "error",
    code: input.code,
    viewerUserIdPrefix: input.viewerUserIdPrefix,
    targetProfileIdPrefix: input.targetProfileIdPrefix,
    pgCode: extractPgErrorCode(input.error),
    constraint: extractPgConstraint(input.error),
  });
}

/** Test helper: ensure a serialized log line never contains forbidden substrings. */
export function assertUnlockLogSafe(line: string, forbidden: string[]): void {
  for (const item of forbidden) {
    if (!item) continue;
    if (line.includes(item)) {
      throw new Error(`sensitive value leaked into unlock log: ${item.slice(0, 8)}…`);
    }
  }
}
