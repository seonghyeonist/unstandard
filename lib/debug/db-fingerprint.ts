import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { migrationSetChecksum } from "@/lib/db/migration-guards";
import {
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
} from "@/lib/db/migration-contract";

export type SafeDbFingerprint = {
  ok: boolean;
  hostSha12: string | null;
  databaseName: string | null;
  currentDatabase: string | null;
  currentUser: string | null;
  migrationSetChecksum: string;
  ledgerLatestHashPrefix: string | null;
  ledgerRowCount: number;
  usersCount: number | null;
  profilesCount: number | null;
  questionsCount: number | null;
  unlocksCount: number | null;
  unlockAttemptsCount: number | null;
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/-pooler(?=\.)/g, "");
}

export function hashDatabaseHostname(hostname: string): string {
  return createHash("sha256").update(normalizeHostname(hostname)).digest("hex").slice(0, 12);
}

export function hostnameFromDatabaseUrl(databaseUrl: string): string | null {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Safe fingerprint for operator ↔ Preview identity proof.
 * Never returns DATABASE_URL, password, or raw hostname.
 */
export async function buildSafeDbFingerprint(databaseUrl: string): Promise<SafeDbFingerprint> {
  const host = hostnameFromDatabaseUrl(databaseUrl);
  const hostSha12 = host ? hashDatabaseHostname(host) : null;
  const sql = neon(databaseUrl);

  const identity = await sql`
    SELECT
      current_database() AS current_database,
      current_user AS current_user
  `;

  let ledger: { hash: string }[] = [];
  try {
    const schema = DRIZZLE_MIGRATIONS_SCHEMA;
    const table = DRIZZLE_MIGRATIONS_TABLE;
    ledger = (await sql.query(
      `SELECT hash FROM ${schema}.${table} ORDER BY created_at DESC LIMIT 5`,
    )) as { hash: string }[];
  } catch {
    ledger = [];
  }

  const counts = await sql`
    SELECT
      (SELECT count(*)::int FROM users) AS users_count,
      (SELECT count(*)::int FROM profiles) AS profiles_count,
      (SELECT count(*)::int FROM questions) AS questions_count,
      (SELECT count(*)::int FROM unlocks) AS unlocks_count,
      (SELECT count(*)::int FROM information_schema.tables
        WHERE table_schema='public' AND table_name='unlock_attempts') AS unlock_attempts_table
  `;

  let unlockAttemptsCount: number | null = null;
  if (Number(counts[0]?.unlock_attempts_table ?? 0) > 0) {
    const attemptRows = await sql`SELECT count(*)::int AS n FROM unlock_attempts`;
    unlockAttemptsCount = Number(attemptRows[0]?.n ?? 0);
  }

  const currentDatabase = String(identity[0]?.current_database ?? "");
  const currentUser = String(identity[0]?.current_user ?? "");
  const latestHash = ledger[0]?.hash ? String(ledger[0].hash) : null;

  return {
    ok: Boolean(hostSha12 && currentDatabase),
    hostSha12,
    databaseName: currentDatabase || null,
    currentDatabase: currentDatabase || null,
    currentUser: currentUser || null,
    migrationSetChecksum: migrationSetChecksum(),
    ledgerLatestHashPrefix: latestHash ? latestHash.slice(0, 12) : null,
    ledgerRowCount: ledger.length,
    usersCount: Number(counts[0]?.users_count ?? 0),
    profilesCount: Number(counts[0]?.profiles_count ?? 0),
    questionsCount: Number(counts[0]?.questions_count ?? 0),
    unlocksCount: Number(counts[0]?.unlocks_count ?? 0),
    unlockAttemptsCount,
  };
}

export function fingerprintsMatch(a: SafeDbFingerprint, b: SafeDbFingerprint): boolean {
  if (!a.ok || !b.ok) return false;
  if (!a.hostSha12 || !b.hostSha12) return false;
  if (a.hostSha12 !== b.hostSha12) return false;
  if (a.currentDatabase !== b.currentDatabase) return false;
  if (a.currentUser !== b.currentUser) return false;
  return true;
}
