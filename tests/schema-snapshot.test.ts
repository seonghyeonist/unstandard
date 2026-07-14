import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  canonicalizeSchemaSnapshot,
  schemaContentDigest,
  type CanonicalSchemaSnapshot,
} from "../lib/db/schema-snapshot";

function baseSnapshot(overrides: Partial<CanonicalSchemaSnapshot> = {}): CanonicalSchemaSnapshot {
  return {
    schema: "public",
    tables: [{ table_name: "users" }],
    columns: [
      {
        table_name: "users",
        column_name: "id",
        ordinal_position: 1,
        data_type: "uuid",
        udt_name: "uuid",
        is_nullable: "NO",
        column_default: null,
        is_identity: "NO",
        identity_generation: null,
        is_generated: "NEVER",
        generation_expression: null,
      },
    ],
    primaryKeys: [
      {
        table_name: "users",
        constraint_name: "users_pkey",
        column_name: "id",
        ordinal_position: 1,
      },
    ],
    uniqueConstraints: [],
    foreignKeys: [
      {
        table_name: "reports",
        constraint_name: "reports_user_fkey",
        column_name: "reporter_id",
        ordinal_position: 1,
        foreign_table_name: "users",
        foreign_column_name: "id",
        update_rule: "NO ACTION",
        delete_rule: "CASCADE",
        is_deferrable: "NO",
        initially_deferred: "NO",
      },
    ],
    checkConstraints: [
      {
        table_name: "reports",
        constraint_name: "reports_reason_check",
        check_clause: "(char_length(reason) > 0)",
      },
    ],
    indexes: [
      {
        table_name: "users",
        index_name: "users_pkey",
        indexdef: "CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)",
      },
    ],
    enums: [
      { enum_name: "report_status", enum_sort_order: 1, enum_value: "open" },
      { enum_name: "report_status", enum_sort_order: 2, enum_value: "closed" },
    ],
    sequences: [],
    rowLevelSecurity: [
      { table_name: "users", relrowsecurity: false, relforcerowsecurity: false },
    ],
    policies: [],
    triggers: [
      {
        table_name: "users",
        trigger_name: "users_touch",
        action_timing: "BEFORE",
        event_manipulation: "UPDATE",
        action_statement: "EXECUTE FUNCTION touch_updated_at()",
      },
    ],
    ...overrides,
  };
}

describe("canonical schema snapshot digest", () => {
  it("row-order permutations produce the same digest", () => {
    const a = baseSnapshot({
      enums: [
        { enum_name: "report_status", enum_sort_order: 2, enum_value: "closed" },
        { enum_name: "report_status", enum_sort_order: 1, enum_value: "open" },
      ],
    });
    const b = baseSnapshot();
    assert.equal(schemaContentDigest(a), schemaContentDigest(b));
    assert.deepEqual(canonicalizeSchemaSnapshot(a).enums, canonicalizeSchemaSnapshot(b).enums);
  });

  it("composite FK metadata remains deterministic", () => {
    const left = baseSnapshot({
      foreignKeys: [
        {
          table_name: "edge",
          constraint_name: "edge_fk",
          column_name: "b",
          ordinal_position: 2,
          foreign_table_name: "users",
          foreign_column_name: "b",
          update_rule: "CASCADE",
          delete_rule: "SET NULL",
          is_deferrable: "YES",
          initially_deferred: "YES",
        },
        {
          table_name: "edge",
          constraint_name: "edge_fk",
          column_name: "a",
          ordinal_position: 1,
          foreign_table_name: "users",
          foreign_column_name: "a",
          update_rule: "CASCADE",
          delete_rule: "SET NULL",
          is_deferrable: "YES",
          initially_deferred: "YES",
        },
      ],
    });
    const right = baseSnapshot({
      foreignKeys: [
        {
          table_name: "edge",
          constraint_name: "edge_fk",
          column_name: "a",
          ordinal_position: 1,
          foreign_table_name: "users",
          foreign_column_name: "a",
          update_rule: "CASCADE",
          delete_rule: "SET NULL",
          is_deferrable: "YES",
          initially_deferred: "YES",
        },
        {
          table_name: "edge",
          constraint_name: "edge_fk",
          column_name: "b",
          ordinal_position: 2,
          foreign_table_name: "users",
          foreign_column_name: "b",
          update_rule: "CASCADE",
          delete_rule: "SET NULL",
          is_deferrable: "YES",
          initially_deferred: "YES",
        },
      ],
    });
    assert.equal(schemaContentDigest(left), schemaContentDigest(right));
  });

  it("FK action change changes the digest", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      foreignKeys: [
        {
          ...before.foreignKeys[0]!,
          delete_rule: "RESTRICT",
        },
      ],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("check expression change changes the digest", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      checkConstraints: [
        {
          table_name: "reports",
          constraint_name: "reports_reason_check",
          check_clause: "(char_length(reason) > 3)",
        },
      ],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("enum value change changes the digest", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      enums: [
        { enum_name: "report_status", enum_sort_order: 1, enum_value: "open" },
        { enum_name: "report_status", enum_sort_order: 2, enum_value: "resolved" },
      ],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("RLS/policy change changes the digest", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      rowLevelSecurity: [
        { table_name: "users", relrowsecurity: true, relforcerowsecurity: false },
      ],
      policies: [
        {
          table_name: "users",
          policy_name: "users_self",
          permissive: "PERMISSIVE",
          roles: "{public}",
          command: "SELECT",
          qual: "(id = current_user_id())",
          with_check: null,
        },
      ],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("trigger change changes the digest", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      triggers: [
        {
          table_name: "users",
          trigger_name: "users_touch",
          action_timing: "AFTER",
          event_manipulation: "UPDATE",
          action_statement: "EXECUTE FUNCTION touch_updated_at()",
        },
      ],
    });
    assert.notEqual(schemaContentDigest(before), schemaContentDigest(after));
  });

  it("documents that digest is not a signature (source contract)", () => {
    const source = readFileSync(join(process.cwd(), "lib/db/schema-snapshot.ts"), "utf8");
    assert.match(source, /NOT a cryptographic signature/i);
    assert.match(source, /schemaContentDigest/);
  });
});
