import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractSafeAuthErrorFields,
  getRedirectOriginHostLabel,
  getRequestHostInfo,
  hasAuthErrorInRequestUrl,
  sanitizeAuthErrorMessage,
} from "../lib/auth/callback-diagnostics.ts";

function makeCallbackRequest(
  path = "/auth/callback?code=abc",
  headers: Record<string, string> = {
    host: "preview.example.com",
    "x-forwarded-host": "preview.example.com",
    "x-forwarded-proto": "https",
  },
): Request {
  return new Request(`https://${headers.host ?? "preview.example.com"}${path}`, { headers });
}

describe("getRequestHostInfo", () => {
  it("reads host and forwarded headers without requiring secrets", () => {
    const info = getRequestHostInfo(makeCallbackRequest());

    assert.deepEqual(info, {
      requestHost: "preview.example.com",
      forwardedHost: "preview.example.com",
      forwardedProto: "https",
    });
    assert.equal("code" in info, false);
    assert.equal("token" in info, false);
  });
});

describe("getRedirectOriginHostLabel", () => {
  it("returns the request origin host label only", () => {
    assert.equal(getRedirectOriginHostLabel(makeCallbackRequest()), "preview.example.com");
  });
});

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

describe("sanitizeAuthErrorMessage", () => {
  it("preserves known safe provider messages", () => {
    assert.equal(sanitizeAuthErrorMessage("email rate limit exceeded"), "email rate limit exceeded");
    assert.equal(
      sanitizeAuthErrorMessage("Email link is invalid or has expired"),
      "Email link is invalid or has expired",
    );
  });

  it("redacts email-like provider messages", () => {
    assert.equal(
      sanitizeAuthErrorMessage("User user@example.com is not allowed"),
      "redacted_auth_error",
    );
  });

  it("redacts token-like provider messages", () => {
    assert.equal(
      sanitizeAuthErrorMessage("Invalid bearer eyJhbGciOiJIUzI1NiJ9.payload"),
      "redacted_auth_error",
    );
  });

  it("redacts unknown provider messages", () => {
    assert.equal(sanitizeAuthErrorMessage("secret internal failure detail"), "redacted_auth_error");
  });
});

describe("extractSafeAuthErrorFields", () => {
  it("extracts safe fields from a Supabase-like auth error", () => {
    const fields = extractSafeAuthErrorFields({
      name: "AuthApiError",
      message: "Email link is invalid or has expired",
      status: 403,
      code: "otp_expired",
      access_token: "secret-token",
      refresh_token: "secret-refresh",
      email: "user@example.com",
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

  it("parses string status values", () => {
    const fields = extractSafeAuthErrorFields({
      name: "AuthApiError",
      message: "Bad request",
      status: "400",
      code: "invalid_request",
    });

    assert.equal(fields.errorStatus, 400);
  });
});
