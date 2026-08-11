import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMigrateTargetAllowed,
  assertStagingMigrationEnv,
  listMigrationSqlFiles,
  migrationSetChecksum,
  requireDatabaseUrl,
  requireDestructiveTestConfirmation,
  requireMigrateConfirmation,
  requireTestDatabaseUrl,
} from "../lib/db/migration-guards";
import { assertTestDatabaseEnv } from "../lib/config/database-env";

describe("migration guards", () => {
  it("rejects missing DATABASE_URL", () => {
    assert.throws(() => requireDatabaseUrl(undefined), /DATABASE_URL is required/);
  });

  it("rejects missing DATABASE_ENV", () => {
    const original = process.env.DATABASE_ENV;
    delete process.env.DATABASE_ENV;
    try {
      assert.throws(() => assertStagingMigrationEnv(), /DATABASE_ENV must be set/);
    } finally {
      if (original) process.env.DATABASE_ENV = original;
    }
  });

  it("rejects missing migration confirmation", () => {
    const original = process.env.UNSTANDARD_CONFIRM_DB_MIGRATE;
    delete process.env.UNSTANDARD_CONFIRM_DB_MIGRATE;
    try {
      assert.throws(() => requireMigrateConfirmation(), /UNSTANDARD_CONFIRM_DB_MIGRATE/);
    } finally {
      if (original) process.env.UNSTANDARD_CONFIRM_DB_MIGRATE = original;
    }
  });

  it("rejects staging migration when DATABASE_ENV=production", () => {
    const original = process.env.DATABASE_ENV;
    process.env.DATABASE_ENV = "production";
    try {
      assert.throws(() => assertStagingMigrationEnv(), /DATABASE_ENV=production/);
    } finally {
      if (original) process.env.DATABASE_ENV = original;
      else delete process.env.DATABASE_ENV;
    }
  });

  it("rejects production-looking URL without production env", () => {
    assert.throws(
      () => assertMigrateTargetAllowed("postgresql://prod-db.example/db", "staging"),
      /production-looking/,
    );
  });

  it("discovers migrations in deterministic order", () => {
    const files = listMigrationSqlFiles();
    assert.ok(files.length >= 1);
    const sorted = [...files].sort();
    assert.deepEqual(files, sorted);
    assert.match(files[0], /^0000_/);
  });

  it("produces stable migration set checksum", () => {
    const a = migrationSetChecksum();
    const b = migrationSetChecksum();
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{16}$/);
  });

  it("requires TEST_DATABASE_URL for integration", () => {
    assert.throws(() => requireTestDatabaseUrl(undefined), /TEST_DATABASE_URL is required/);
  });

  it("requires destructive test confirmation", () => {
    const original = process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST;
    delete process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST;
    try {
      assert.throws(() => requireDestructiveTestConfirmation(), /UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST/);
    } finally {
      if (original) process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST = original;
    }
  });

  it("requires DATABASE_ENV=test for destructive tests", () => {
    const original = process.env.DATABASE_ENV;
    process.env.DATABASE_ENV = "staging";
    try {
      assert.throws(() => assertTestDatabaseEnv(), /DATABASE_ENV=test/);
    } finally {
      if (original) process.env.DATABASE_ENV = original;
      else delete process.env.DATABASE_ENV;
    }
  });
});
