import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUuid } from "../lib/server/unlock/uuid.ts";
import {
  unlockErrorClientMessage,
  unlockErrorHttpStatus,
} from "../lib/unlock/unlock-codes.ts";
import {
  fingerprintsMatch,
  hashDatabaseHostname,
  hostnameFromDatabaseUrl,
  type SafeDbFingerprint,
} from "../lib/debug/db-fingerprint.ts";

describe("unlock uuid + error mapping", () => {
  it("accepts UUID profile ids only", () => {
    assert.equal(isUuid("c3"), false);
    assert.equal(isUuid("8bcb3e0e-49a9-4e1d-ba70-88b7a49d154d"), true);
  });

  it("maps FK/capability failures to safe statuses", () => {
    assert.equal(unlockErrorHttpStatus("UNAUTHORIZED"), 401);
    assert.equal(unlockErrorHttpStatus("INVALID_PROFILE_ID"), 400);
    assert.equal(unlockErrorHttpStatus("PROFILE_NOT_FOUND"), 404);
    assert.equal(unlockErrorHttpStatus("SELF_UNLOCK_NOT_ALLOWED"), 403);
    assert.equal(unlockErrorHttpStatus("PROFILE_NOT_ONBOARDED"), 409);
    assert.equal(unlockErrorHttpStatus("UNLOCK_SERVICE_UNAVAILABLE"), 503);
  });

  it("keeps client messages free of postgres detail", () => {
    for (const code of [
      "PERSISTENCE_FAILED",
      "UNLOCK_SERVICE_UNAVAILABLE",
      "PROFILE_NOT_FOUND",
    ] as const) {
      const message = unlockErrorClientMessage(code);
      assert.equal(message.includes("23503"), false);
      assert.equal(message.includes("DATABASE_URL"), false);
    }
  });
});

describe("db fingerprint helpers", () => {
  it("normalizes pooler hostname variants to one hash", () => {
    const a = hashDatabaseHostname("ep-example.c-3.us-east-2.aws.neon.tech");
    const b = hashDatabaseHostname("ep-example-pooler.c-3.us-east-2.aws.neon.tech");
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{12}$/);
  });

  it("extracts hostname without exposing credentials", () => {
    const host = hostnameFromDatabaseUrl(
      "postgresql://neondb_owner:secret@ep-example-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require",
    );
    assert.equal(host, "ep-example-pooler.c-3.us-east-2.aws.neon.tech");
  });

  it("matches fingerprints on host/db/user only", () => {
    const base: SafeDbFingerprint = {
      ok: true,
      hostSha12: "aabbccddeeff",
      databaseName: "neondb",
      currentDatabase: "neondb",
      currentUser: "neondb_owner",
      migrationSetChecksum: "x",
      ledgerLatestHashPrefix: "y",
      ledgerRowCount: 1,
      usersCount: 1,
      profilesCount: 1,
      questionsCount: 1,
      unlocksCount: 0,
      unlockAttemptsCount: 0,
    };
    assert.equal(fingerprintsMatch(base, { ...base, unlocksCount: 9 }), true);
    assert.equal(fingerprintsMatch(base, { ...base, hostSha12: "000000000000" }), false);
  });
});
