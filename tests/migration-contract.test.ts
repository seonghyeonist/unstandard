import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  compareMigrationLedgers,
  getDrizzleMigrationConfig,
  normalizeMigrationLedger,
} from "../lib/db/migration-contract";
import { getDrizzleMigrationConfig as getConfigFromRunner } from "../lib/db/run-migrations";
import {
  canonicalizeSchemaSnapshot,
  schemaContentDigest,
} from "../lib/db/schema-snapshot";

describe("migration ledger contract", () => {
  it("shares ledger schema/table with migrator configuration", () => {
    const config = getDrizzleMigrationConfig();
    assert.equal(config.migrationsSchema, DRIZZLE_MIGRATIONS_SCHEMA);
    assert.equal(config.migrationsTable, DRIZZLE_MIGRATIONS_TABLE);
    assert.equal(DRIZZLE_MIGRATIONS_SCHEMA, "drizzle");
    assert.equal(DRIZZLE_MIGRATIONS_TABLE, "__drizzle_migrations");
    assert.deepEqual(config, getConfigFromRunner());
  });

  it("detects unchanged ledger across second-run snapshots", () => {
    const before = [
      { id: 1, hash: "aaa", created_at: "1" },
      { id: 2, hash: "bbb", created_at: "2" },
    ];
    const after = [
      { id: 2, hash: "bbb", created_at: "2" },
      { id: 1, hash: "aaa", created_at: "1" },
    ];
    assert.equal(normalizeMigrationLedger(before), normalizeMigrationLedger(after));
    assert.deepEqual(compareMigrationLedgers(before, after), []);
  });

  it("fails when second run adds a ledger row", () => {
    const before = [{ id: 1, hash: "aaa", created_at: "1" }];
    const after = [
      { id: 1, hash: "aaa", created_at: "1" },
      { id: 2, hash: "bbb", created_at: "2" },
    ];
    const failures = compareMigrationLedgers(before, after);
    assert.ok(failures.some((f) => f.includes("row count")));
  });

  it("fails when ledger entry hash changes", () => {
    const before = [{ id: 1, hash: "aaa", created_at: "1" }];
    const after = [{ id: 1, hash: "CHANGED", created_at: "1" }];
    const failures = compareMigrationLedgers(before, after);
    assert.ok(failures.some((f) => f.includes("entries changed")));
  });

  it("fails when ledger is missing/empty before comparison", () => {
    const failures = compareMigrationLedgers([], []);
    assert.ok(failures.some((f) => f.includes("empty")));
  });

  it("treats schemaContentDigest inequality as structural drift", () => {
    const before = canonicalizeSchemaSnapshot({
      schema: "public",
      tables: [{ table_name: "users" }],
      columns: [],
      primaryKeys: [],
      uniqueConstraints: [],
      foreignKeys: [],
      checkConstraints: [],
      indexes: [],
      enums: [],
      sequences: [],
      rowLevelSecurity: [],
      policies: [],
      triggers: [],
    });
    const after = canonicalizeSchemaSnapshot({
      ...before,
      tables: [{ table_name: "users" }, { table_name: "extra" }],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("run-migrations imports shared config (source contract)", () => {
    const source = readFileSync(join(process.cwd(), "lib/db/run-migrations.ts"), "utf8");
    assert.match(source, /getDrizzleMigrationConfig/);
    assert.match(source, /migrate\(db, getDrizzleMigrationConfig\(\)\)/);
    assert.match(source, /computeApplicationSchemaSnapshot/);
  });
});
