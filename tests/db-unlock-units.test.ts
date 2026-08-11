import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCanonicalUuid, isUuid } from "../lib/server/unlock/uuid.ts";
import {
  credentialsOwnExpectedProfiles,
  validateSmokeProfileIds,
} from "../lib/smoke/authorization-preflight.ts";
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
    assert.equal(isCanonicalUuid("8BCB3E0E-49A9-4E1D-BA70-88B7A49D154D"), false);
  });

  it("smoke_rejects_non_uuid_profiles", () => {
    const validA = "d28f5b1d-2d32-42ec-98eb-b90d0d2d9a37";
    const validB = "8bcb3e0e-49a9-4e1d-ba70-88b7a49d154d";
    for (const invalid of ["", "c1", "c2", "c3", "not-a-uuid"]) {
      assert.ok(validateSmokeProfileIds(invalid, validB).length > 0);
      assert.ok(validateSmokeProfileIds(validA, invalid).length > 0);
    }
    assert.deepEqual(validateSmokeProfileIds(validA, validB), []);
  });

  it("smoke_rejects_same_profile_ids", () => {
    const validA = "d28f5b1d-2d32-42ec-98eb-b90d0d2d9a37";
    assert.ok(validateSmokeProfileIds(validA, validA).length > 0);
  });

  it("proves credential/profile mapping from self-excluding DB candidates", () => {
    const profileAId = "d28f5b1d-2d32-42ec-98eb-b90d0d2d9a37";
    const profileBId = "8bcb3e0e-49a9-4e1d-ba70-88b7a49d154d";
    const body = (ids: string[]) => ({
      source: "database",
      candidates: ids.map((id) => ({ id })),
    });

    assert.equal(
      credentialsOwnExpectedProfiles({
        profileAId,
        profileBId,
        candidatesForA: body([profileBId]),
        candidatesForB: body([profileAId]),
      }),
      true,
    );
    assert.equal(
      credentialsOwnExpectedProfiles({
        profileAId,
        profileBId,
        candidatesForA: body([profileAId]),
        candidatesForB: body([profileBId]),
      }),
      false,
    );
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
