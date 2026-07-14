/**
 * Canonical application schema snapshot.
 *
 * schemaContentDigest is a SHA-256 of the canonical JSON snapshot.
 * It is NOT a cryptographic signature of Production deployment state.
 * It detects structural changes within the inspected metadata only.
 */

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { APPLICATION_SCHEMA } from "./migration-contract";

export type SchemaScalar = string | number | boolean | null;

export type CanonicalSchemaSnapshot = {
  schema: string;
  tables: Array<Record<string, SchemaScalar>>;
  columns: Array<Record<string, SchemaScalar>>;
  primaryKeys: Array<Record<string, SchemaScalar>>;
  uniqueConstraints: Array<Record<string, SchemaScalar>>;
  foreignKeys: Array<Record<string, SchemaScalar>>;
  checkConstraints: Array<Record<string, SchemaScalar>>;
  indexes: Array<Record<string, SchemaScalar>>;
  enums: Array<Record<string, SchemaScalar>>;
  sequences: Array<Record<string, SchemaScalar>>;
  rowLevelSecurity: Array<Record<string, SchemaScalar>>;
  policies: Array<Record<string, SchemaScalar>>;
  triggers: Array<Record<string, SchemaScalar>>;
};

type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
};

function scalar(value: unknown): SchemaScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return String(value);
}

function pick(
  row: Record<string, unknown>,
  keys: readonly string[],
): Record<string, SchemaScalar> {
  const out: Record<string, SchemaScalar> = {};
  for (const key of keys) {
    out[key] = scalar(row[key]);
  }
  return out;
}

function compareScalars(a: SchemaScalar, b: SchemaScalar): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

/** Stable sort by ordered key names. SQL ORDER BY is not trusted for digests. */
export function sortRowsByKeys(
  rows: Array<Record<string, SchemaScalar>>,
  keys: readonly string[],
): Array<Record<string, SchemaScalar>> {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const cmp = compareScalars(left[key] ?? null, right[key] ?? null);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

export function canonicalizeSchemaSnapshot(raw: CanonicalSchemaSnapshot): CanonicalSchemaSnapshot {
  return {
    schema: raw.schema,
    tables: sortRowsByKeys(
      raw.tables.map((row) => pick(row, ["table_name"])),
      ["table_name"],
    ),
    columns: sortRowsByKeys(
      raw.columns.map((row) =>
        pick(row, [
          "table_name",
          "column_name",
          "ordinal_position",
          "data_type",
          "udt_name",
          "is_nullable",
          "column_default",
          "is_identity",
          "identity_generation",
          "is_generated",
          "generation_expression",
        ]),
      ),
      ["table_name", "ordinal_position", "column_name"],
    ),
    primaryKeys: sortRowsByKeys(
      raw.primaryKeys.map((row) =>
        pick(row, ["table_name", "constraint_name", "column_name", "ordinal_position"]),
      ),
      ["table_name", "constraint_name", "ordinal_position", "column_name"],
    ),
    uniqueConstraints: sortRowsByKeys(
      raw.uniqueConstraints.map((row) =>
        pick(row, ["table_name", "constraint_name", "column_name", "ordinal_position"]),
      ),
      ["table_name", "constraint_name", "ordinal_position", "column_name"],
    ),
    foreignKeys: sortRowsByKeys(
      raw.foreignKeys.map((row) =>
        pick(row, [
          "table_name",
          "constraint_name",
          "column_name",
          "ordinal_position",
          "foreign_table_name",
          "foreign_column_name",
          "update_rule",
          "delete_rule",
          "is_deferrable",
          "initially_deferred",
        ]),
      ),
      ["table_name", "constraint_name", "ordinal_position", "column_name"],
    ),
    checkConstraints: sortRowsByKeys(
      raw.checkConstraints.map((row) =>
        pick(row, ["table_name", "constraint_name", "check_clause"]),
      ),
      ["table_name", "constraint_name", "check_clause"],
    ),
    indexes: sortRowsByKeys(
      raw.indexes.map((row) => pick(row, ["table_name", "index_name", "indexdef"])),
      ["table_name", "index_name", "indexdef"],
    ),
    enums: sortRowsByKeys(
      raw.enums.map((row) => pick(row, ["enum_name", "enum_sort_order", "enum_value"])),
      ["enum_name", "enum_sort_order", "enum_value"],
    ),
    sequences: sortRowsByKeys(
      raw.sequences.map((row) =>
        pick(row, [
          "sequence_name",
          "data_type",
          "start_value",
          "minimum_value",
          "maximum_value",
          "increment",
          "cycle_option",
          "owned_by_table",
          "owned_by_column",
        ]),
      ),
      ["sequence_name", "owned_by_table", "owned_by_column"],
    ),
    rowLevelSecurity: sortRowsByKeys(
      raw.rowLevelSecurity.map((row) =>
        pick(row, ["table_name", "relrowsecurity", "relforcerowsecurity"]),
      ),
      ["table_name"],
    ),
    policies: sortRowsByKeys(
      raw.policies.map((row) =>
        pick(row, [
          "table_name",
          "policy_name",
          "permissive",
          "roles",
          "command",
          "qual",
          "with_check",
        ]),
      ),
      ["table_name", "policy_name", "command"],
    ),
    triggers: sortRowsByKeys(
      raw.triggers.map((row) =>
        pick(row, [
          "table_name",
          "trigger_name",
          "action_timing",
          "event_manipulation",
          "action_statement",
        ]),
      ),
      ["table_name", "trigger_name", "event_manipulation"],
    ),
  };
}

export function schemaSnapshotJson(snapshot: CanonicalSchemaSnapshot): string {
  return `${JSON.stringify(canonicalizeSchemaSnapshot(snapshot))}\n`;
}

/**
 * SHA-256 of the canonical snapshot JSON.
 * Not a signature; not Production attestation.
 */
export function schemaContentDigest(snapshot: CanonicalSchemaSnapshot): string {
  return createHash("sha256").update(schemaSnapshotJson(snapshot), "utf8").digest("hex");
}

async function gatherSchemaSnapshot(sql: SqlClient, schema: string): Promise<CanonicalSchemaSnapshot> {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_type = 'BASE TABLE'
  `;

  const columns = await sql`
    SELECT
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      is_identity,
      identity_generation,
      is_generated,
      generation_expression
    FROM information_schema.columns
    WHERE table_schema = ${schema}
  `;

  const primaryKeys = await sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = ${schema}
      AND tc.constraint_type = 'PRIMARY KEY'
  `;

  const uniqueConstraints = await sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = ${schema}
      AND tc.constraint_type = 'UNIQUE'
  `;

  const foreignKeys = await sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule,
      tc.is_deferrable,
      tc.initially_deferred
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_schema = rc.constraint_schema
      AND tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_schema = ccu.constraint_schema
      AND rc.unique_constraint_name = ccu.constraint_name
      AND kcu.ordinal_position = ccu.ordinal_position
    WHERE tc.table_schema = ${schema}
      AND tc.constraint_type = 'FOREIGN KEY'
  `;

  const checkConstraints = await sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_schema = cc.constraint_schema
      AND tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = ${schema}
      AND tc.constraint_type = 'CHECK'
  `;

  const indexes = await sql`
    SELECT
      tablename AS table_name,
      indexname AS index_name,
      indexdef
    FROM pg_indexes
    WHERE schemaname = ${schema}
  `;

  const enums = await sql`
    SELECT
      t.typname AS enum_name,
      e.enumsortorder AS enum_sort_order,
      e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = ${schema}
  `;

  const sequences = await sql`
    SELECT
      s.sequencename AS sequence_name,
      s.data_type,
      s.start_value,
      s.min_value AS minimum_value,
      s.max_value AS maximum_value,
      s.increment_by AS increment,
      s.cycle AS cycle_option,
      c.relname AS owned_by_table,
      a.attname AS owned_by_column
    FROM pg_sequences s
    JOIN pg_class seq ON seq.relname = s.sequencename
    JOIN pg_namespace n ON n.oid = seq.relnamespace AND n.nspname = s.schemaname
    LEFT JOIN pg_depend d
      ON d.objid = seq.oid
      AND d.deptype = 'a'
    LEFT JOIN pg_class c ON c.oid = d.refobjid
    LEFT JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE s.schemaname = ${schema}
      AND c.relname IS NOT NULL
  `;

  const rowLevelSecurity = await sql`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity,
      c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema}
      AND c.relkind = 'r'
  `;

  const policies = await sql`
    SELECT
      c.relname AS table_name,
      p.polname AS policy_name,
      CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
      ARRAY(
        SELECT rolname FROM pg_roles WHERE oid = ANY (p.polroles)
      )::text AS roles,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE '*'
      END AS command,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema}
  `;

  const triggers = await sql`
    SELECT
      event_object_table AS table_name,
      trigger_name,
      action_timing,
      event_manipulation,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = ${schema}
      AND trigger_name NOT LIKE 'pg_%'
  `;

  return {
    schema,
    tables: tables as Array<Record<string, SchemaScalar>>,
    columns: columns as Array<Record<string, SchemaScalar>>,
    primaryKeys: primaryKeys as Array<Record<string, SchemaScalar>>,
    uniqueConstraints: uniqueConstraints as Array<Record<string, SchemaScalar>>,
    foreignKeys: foreignKeys as Array<Record<string, SchemaScalar>>,
    checkConstraints: checkConstraints as Array<Record<string, SchemaScalar>>,
    indexes: indexes as Array<Record<string, SchemaScalar>>,
    enums: enums as Array<Record<string, SchemaScalar>>,
    sequences: sequences as Array<Record<string, SchemaScalar>>,
    rowLevelSecurity: rowLevelSecurity as Array<Record<string, SchemaScalar>>,
    policies: policies as Array<Record<string, SchemaScalar>>,
    triggers: triggers as Array<Record<string, SchemaScalar>>,
  };
}

export async function computeApplicationSchemaSnapshot(databaseUrl: string): Promise<{
  snapshot: CanonicalSchemaSnapshot;
  schemaContentDigest: string;
  canonicalJson: string;
}> {
  const sql = neon(databaseUrl) as unknown as SqlClient;
  const gathered = await gatherSchemaSnapshot(sql, APPLICATION_SCHEMA);
  const snapshot = canonicalizeSchemaSnapshot(gathered);
  const canonicalJson = schemaSnapshotJson(snapshot);
  return {
    snapshot,
    schemaContentDigest: schemaContentDigest(snapshot),
    canonicalJson,
  };
}

/**
 * @deprecated Prefer computeApplicationSchemaSnapshot + schemaContentDigest.
 * Retained as digest string for callers expecting a single comparable token.
 */
export async function computeApplicationSchemaFingerprint(databaseUrl: string): Promise<string> {
  const { schemaContentDigest: digest } = await computeApplicationSchemaSnapshot(databaseUrl);
  return digest;
}
