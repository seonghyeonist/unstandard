import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPgErrorCode, translateDatabaseError } from "../lib/db/errors";

describe("extractPgErrorCode / translateDatabaseError", () => {
  it("reads SQLSTATE from a Drizzle-wrapped cause chain", () => {
    const root = Object.assign(new Error("Failed query: insert"), {
      cause: Object.assign(new Error("unique_violation"), { code: "23505" }),
    });
    assert.equal(extractPgErrorCode(root), "23505");
    assert.equal(translateDatabaseError(root).code, "UNIQUE_VIOLATION");
  });

  it("reads check-violation 23514 from nested cause", () => {
    const root = Object.assign(new Error("Failed query"), {
      cause: { code: "23514", message: "check" },
    });
    assert.equal(extractPgErrorCode(root), "23514");
    assert.equal(translateDatabaseError(root).code, "CHECK_VIOLATION");
  });

  it("returns undefined when no SQLSTATE is present", () => {
    assert.equal(extractPgErrorCode(new Error("nope")), undefined);
    assert.equal(translateDatabaseError(new Error("nope")).code, "UNKNOWN");
  });
});
