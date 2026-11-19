import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseTarget } from "../db/client.mts";
import { cookieName, digestToken, entitlementExpiresAt, readSessionCookie, roomLifetimeMs } from "../server/session.mts";

test("session cookies yield one digest and reject ambiguous or malformed values", () => {
  const fixture = Buffer.alloc(32, 7).toString("base64url");
  const cookie = cookieName + "=" + fixture;
  assert.equal(readSessionCookie("other=1; " + cookie), digestToken(fixture));
  assert.equal(readSessionCookie(cookie + "; " + cookie), null);
  assert.equal(readSessionCookie(cookieName + "=abc"), null);
  assert.equal(readSessionCookie(undefined), null);
});

test("room entitlement is capped at 14 elapsed days after verified payment", () => {
  const paid = new Date("2026-11-19T00:00:00Z");
  const cutoff = new Date(paid.getTime() + roomLifetimeMs);
  assert.deepEqual(entitlementExpiresAt(paid, new Date("2027-01-01")), cutoff);
  assert.deepEqual(entitlementExpiresAt(paid, paid), paid);
});

test("database target requires the independent database and an exact approved remote hostname", () => {
  const b2c = "postgresql://fixture@127.0.0.1:5432/unstandard_b2c";
  const remote = "postgresql://fixture@db.example.com/unstandard_b2c";
  assert.equal(databaseTarget({B2C_DATABASE_URL: b2c}).local, true);
  assert.equal(databaseTarget({B2C_DATABASE_URL: remote, B2C_EXPECT_DB_HOST: "db.example.com"}).local, false);
  assert.throws(() => databaseTarget({DATABASE_URL: b2c}), /B2C_DATABASE_URL is required/);
  assert.throws(() => databaseTarget({B2C_DATABASE_URL: remote}), /exactly match/);
  assert.throws(() => databaseTarget({B2C_DATABASE_URL: b2c.replace("unstandard_b2c", "alpha")}), /dedicated/);
});
