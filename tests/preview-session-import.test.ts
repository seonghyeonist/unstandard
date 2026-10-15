import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import { canImportPreviewSession, existingSessionCookie } from "../lib/auth/preview-session-import";

const rc = { VERCEL_ENV: "preview", DATABASE_ENV: "staging", UNSTANDARD_RUNTIME_MODE: "database", DIDIT_EXPECTED_ENVIRONMENT: "sandbox", DATABASE_URL: "postgresql://fixture:fixture@fixture.neon.tech/unstandard_rc_it_20260929_0940a" };
const hostSha12 = createHash("sha256").update("fixture.neon.tech").digest("hex").slice(0, 12);
const now = Date.parse("2026-10-07T06:00:00Z");
test("session import is confined to named Sandbox RC and expires", () => {
  assert.equal(canImportPreviewSession(rc, now, hostSha12), true);
  assert.equal(canImportPreviewSession(rc, now), false);
  for (const patch of [{ VERCEL_ENV: "production" }, { DATABASE_ENV: "production" }, { DIDIT_EXPECTED_ENVIRONMENT: "live" }, { UNSTANDARD_RUNTIME_MODE: "mock" }, { DATABASE_URL: "postgresql://fixture:fixture@fixture.neon.tech/neondb" }]) assert.equal(canImportPreviewSession({ ...rc, ...patch }, now, hostSha12), false);
  assert.equal(canImportPreviewSession(rc, Date.parse("2026-10-12T23:59:00Z"), hostSha12), false);
});
test("cookie encoding interoperates with the installed auth verifier", async () => {
  const token = "existing-server-issued-fixture-token", secret = "fixture-only-auth-secret";
  const pair = existingSessionCookie(token, secret);
  const [value, signature] = decodeURIComponent(pair.slice(pair.indexOf("=") + 1)).split(".");
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  assert.equal(await webcrypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64"), new TextEncoder().encode(value)), true);
  assert.equal(await webcrypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64"), new TextEncoder().encode(value + "tamper")), false);
});
test("untrusted token cannot inject cookie delimiters", () => {
  for (const token of ["short", "x".repeat(257), "validlengthtokenbut;injection", "validlengthtokenbut\r\ninjection"]) assert.throws(() => existingSessionCookie(token, "fixture"));
});
