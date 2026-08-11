import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  privateProfileResponseHasSensitiveFields,
  sessionResponseHasSensitiveFields,
} from "../lib/smoke/response-redaction.ts";

describe("smoke response redaction", () => {
  it("accepts a private payload with only a validated correlation id", () => {
    assert.equal(
      privateProfileResponseHasSensitiveFields({
        letter: "hello",
        smallJoys: ["books"],
        source: "database",
        correlationId: "c126f93b-2496-4024-a543-d44966b709e4",
      }),
      false,
    );
  });

  it("still rejects private payload ids, emails, and tokens", () => {
    const correlationId = "c126f93b-2496-4024-a543-d44966b709e4";
    assert.equal(
      privateProfileResponseHasSensitiveFields({
        correlationId,
        profileId: "a7c79965-4b68-452a-9766-341ecaed5943",
      }),
      true,
    );
    assert.equal(
      privateProfileResponseHasSensitiveFields({ correlationId, email: "member@example.com" }),
      true,
    );
    assert.equal(
      privateProfileResponseHasSensitiveFields({ correlationId, token: "secret" }),
      true,
    );
  });

  it("requires a valid private response correlation id", () => {
    assert.equal(privateProfileResponseHasSensitiveFields({ letter: "hello" }), true);
    assert.equal(
      privateProfileResponseHasSensitiveFields({ letter: "hello", correlationId: "not-a-uuid" }),
      true,
    );
  });

  it("keeps session responses on the stricter no-uuid contract", () => {
    assert.equal(sessionResponseHasSensitiveFields({ user: { nickname: "A Smoke" } }), false);
    assert.equal(
      sessionResponseHasSensitiveFields({
        user: { id: "a7c79965-4b68-452a-9766-341ecaed5943" },
      }),
      true,
    );
  });
});
