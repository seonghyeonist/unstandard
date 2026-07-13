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
  message?: string;
};

export function translateDatabaseError(error: unknown): DatabaseError {
  const pg = error as PgErrorLike;
  const pgCode = pg?.code;

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
