export type DatabaseErrorCode =
  | "UNIQUE_VIOLATION"
  | "FOREIGN_KEY_VIOLATION"
  | "CHECK_VIOLATION"
  | "NOT_FOUND"
  | "UNKNOWN";

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly pgCode?: string;

  constructor(code: DatabaseErrorCode, message: string, pgCode?: string) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.pgCode = pgCode;
  }
}

type PgErrorLike = {
  code?: string;
  cause?: unknown;
  message?: string;
};

/**
 * Drizzle wraps driver errors (`Failed query: ...`) so the PostgreSQL SQLSTATE
 * often lives on `error.cause` (and sometimes deeper). Walk a short cause chain.
 */
export function extractPgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    const candidate = (current as PgErrorLike).code;
    // PostgreSQL SQLSTATE is a 5-char class+code (e.g. 23505, 23514).
    if (typeof candidate === "string" && /^[0-9A-Z]{5}$/.test(candidate)) {
      return candidate;
    }
    current = (current as PgErrorLike).cause;
  }
  return undefined;
}

export function translateDatabaseError(error: unknown): DatabaseError {
  const pgCode = extractPgErrorCode(error);

  if (pgCode === "23505") {
    return new DatabaseError("UNIQUE_VIOLATION", "Unique constraint violated", pgCode);
  }
  if (pgCode === "23503") {
    return new DatabaseError("FOREIGN_KEY_VIOLATION", "Foreign key constraint violated", pgCode);
  }
  if (pgCode === "23514") {
    return new DatabaseError("CHECK_VIOLATION", "Check constraint violated", pgCode);
  }

  const message = error instanceof Error ? error.message : "Database error";
  return new DatabaseError("UNKNOWN", message, pgCode);
}
