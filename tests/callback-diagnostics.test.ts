import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractSafeAuthErrorFields,
  hasAuthErrorInRequestUrl,
} from "../lib/auth/callback-diagnostics.ts";
import {
  parseAuthHashErrorCode,
  resolveCallbackHashLoginMessage,
} from "../lib/auth/callback-hash-errors.ts";

describe("hasAuthErrorInRequestUrl", () => {
  it("detects query-string auth errors", () => {
    assert.equal(
      hasAuthErrorInRequestUrl(
        "https://preview.example.com/auth/callback?error=access_denied&error_code=otp_expired",
      ),
      true,
    );
  });

  it("returns false when no auth error markers are present", () => {
    assert.equal(
      hasAuthErrorInRequestUrl("https://preview.example.com/auth/callback?code=abc"),
      false,
    );
  });
});

describe("extractSafeAuthErrorFields", () => {
  it("extracts safe fields from a Supabase-like auth error", () => {
    const fields = extractSafeAuthErrorFields({
      name: "AuthApiError",
      message: "Email link is invalid or has expired",
      status: 403,
      code: "otp_expired",
    });

    assert.deepEqual(fields, {
      errorName: "AuthApiError",
      errorMessage: "Email link is invalid or has expired",
      errorStatus: 403,
      errorCode: "otp_expired",
    });
  });

  it("returns null fields for non-object errors", () => {
    assert.deepEqual(extractSafeAuthErrorFields("boom"), {
      errorName: null,
      errorMessage: null,
      errorStatus: null,
      errorCode: null,
    });
  });
});

describe("callback hash error helpers", () => {
  it("parses otp_expired from hash fragment", () => {
    assert.equal(
      parseAuthHashErrorCode(
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
      "otp_expired",
    );
  });

  it("returns a user-safe message for otp_expired", () => {
    const message = resolveCallbackHashLoginMessage("otp_expired");
    assert.match(message ?? "", /expired/i);
    assert.match(message ?? "", /fresh/i);
  });
});
