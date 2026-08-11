import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthorizedOperatorRequest } from "../lib/security/operator-token.ts";

describe("operator token", () => {
  it("accepts only an exact Bearer credential", () => {
    const valid = new Request("https://alpha.example.com/api/operations/readiness", {
      headers: { Authorization: "Bearer operator-secret" },
    });
    const wrong = new Request("https://alpha.example.com/api/operations/readiness", {
      headers: { Authorization: "Bearer operator-secreu" },
    });

    assert.equal(isAuthorizedOperatorRequest(valid, "operator-secret"), true);
    assert.equal(isAuthorizedOperatorRequest(wrong, "operator-secret"), false);
  });

  it("rejects query-string credentials and missing server configuration", () => {
    const query = new Request(
      "https://alpha.example.com/api/operations/readiness?token=operator-secret",
    );
    assert.equal(isAuthorizedOperatorRequest(query, "operator-secret"), false);
    assert.equal(isAuthorizedOperatorRequest(query, undefined), false);
  });
});
