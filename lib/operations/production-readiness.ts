import { neon } from "@neondatabase/serverless";
import {
  APPLICATION_SCHEMA,
  DRIZZLE_MIGRATIONS_SCHEMA,
  DRIZZLE_MIGRATIONS_TABLE,
  REQUIRED_APPLICATION_TABLES,
} from "@/lib/db/migration-contract";
import { EXPECTED_MIGRATION_HASHES } from "@/lib/db/migration-manifest";
import { hashDatabaseHostname, hostnameFromDatabaseUrl } from "@/lib/debug/db-fingerprint";
import { SEED_APP_CONFIG_KEY } from "@/lib/db/seed-data";
import {
  DEFAULT_UNLOCK_QUESTION_ID,
  UNLOCK_QUESTION_CONFIG_KEY,
} from "@/lib/unlock/question-constants";

export type ReadinessGateStatus = "PASS" | "FAIL";

export type ProductionReadinessGate = {
  name: string;
  status: ReadinessGateStatus;
  code: string;
};

export type ProductionEnvironmentSnapshot = {
  nodeEnv: string | null;
  vercelEnv: string | null;
  runtimeMode: string | null;
  databaseEnv: string | null;
  releaseSha: string | null;
  hasDatabaseUrl: boolean;
  hasBetterAuthSecret: boolean;
  hasBetterAuthUrl: boolean;
  hasAuthCookieSecret: boolean;
  hasUnstandardAppUrl: boolean;
  betterAuthUrl: string | null;
  unstandardAppUrl: string | null;
};

export type ProductionDatabaseObservation = {
  hostSha12: string | null;
  currentDatabase: string | null;
  migrationHashes: string[];
  presentTables: string[];
  alphaClosedEnabled: boolean;
  unlockQuestionId: string | null;
  unlockQuestionActive: boolean;
};

export type ProductionReadinessReport = {
  artifactVersion: 1;
  kind: "production_readiness";
  ok: boolean;
  generatedAt: string;
  release: {
    gitSha: string | null;
    vercelEnv: string | null;
    requestHost: string | null;
  };
  database: {
    hostSha12: string | null;
    currentDatabase: string | null;
    migrationCount: number;
    requiredTableCount: number;
  };
  gates: ProductionReadinessGate[];
};

export const PRODUCTION_READINESS_PASS_CODES = [
  "PRODUCTION_TARGET_CONFIRMED",
  "DATABASE_RUNTIME_CONFIRMED",
  "REQUIRED_SECRETS_PRESENT",
  "CANONICAL_ORIGINS_MATCH",
  "RELEASE_SHA_PRESENT",
  "DATABASE_CONNECTED",
  "MIGRATION_LEDGER_EXACT",
  "REQUIRED_TABLES_PRESENT",
  "CLOSED_ALPHA_ENABLED",
  "UNLOCK_QUESTION_ACTIVE",
] as const;

function gate(name: string, passed: boolean, passCode: string, failCode: string) {
  return {
    name,
    status: passed ? ("PASS" as const) : ("FAIL" as const),
    code: passed ? passCode : failCode,
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalHttpsOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== "/") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function snapshotProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): ProductionEnvironmentSnapshot {
  const databaseUrl = env.DATABASE_URL?.trim();
  const releaseSha = env.VERCEL_GIT_COMMIT_SHA?.trim() || env.UNSTANDARD_RELEASE_SHA?.trim();
  const betterAuthUrl = env.BETTER_AUTH_URL?.trim();
  const unstandardAppUrl = env.UNSTANDARD_APP_URL?.trim();

  return {
    nodeEnv: env.NODE_ENV?.trim() || null,
    vercelEnv: env.VERCEL_ENV?.trim() || null,
    runtimeMode: env.UNSTANDARD_RUNTIME_MODE?.trim() || null,
    databaseEnv: env.DATABASE_ENV?.trim() || null,
    releaseSha: releaseSha || null,
    hasDatabaseUrl: Boolean(databaseUrl),
    hasBetterAuthSecret: Boolean(env.BETTER_AUTH_SECRET?.trim()),
    hasBetterAuthUrl: Boolean(betterAuthUrl),
    hasAuthCookieSecret: Boolean(env.AUTH_COOKIE_SECRET?.trim()),
    hasUnstandardAppUrl: Boolean(unstandardAppUrl),
    betterAuthUrl: betterAuthUrl || null,
    unstandardAppUrl: unstandardAppUrl || null,
  };
}

export async function observeProductionDatabase(
  databaseUrl: string,
): Promise<ProductionDatabaseObservation> {
  const hostname = hostnameFromDatabaseUrl(databaseUrl);
  const sql = neon(databaseUrl);

  const [identityRows, ledgerRows, tableRows, configRows] = await Promise.all([
    sql`SELECT current_database() AS current_database`,
    sql.query(
      `SELECT hash FROM ${DRIZZLE_MIGRATIONS_SCHEMA}.${DRIZZLE_MIGRATIONS_TABLE} ORDER BY id ASC`,
    ),
    sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${APPLICATION_SCHEMA}
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `,
    sql`
      SELECT
        COALESCE((closed.value ->> 'enabled') = 'true', false) AS alpha_closed_enabled,
        unlock.value ->> 'questionId' AS unlock_question_id,
        COALESCE(question.active, false) AS unlock_question_active
      FROM (SELECT 1) AS singleton
      LEFT JOIN app_config AS closed ON closed.key = ${SEED_APP_CONFIG_KEY}
      LEFT JOIN app_config AS unlock ON unlock.key = ${UNLOCK_QUESTION_CONFIG_KEY}
      LEFT JOIN questions AS question ON question.id::text = (unlock.value ->> 'questionId')
      LIMIT 1
    `,
  ]);

  const config = configRows[0] as Record<string, unknown> | undefined;
  return {
    hostSha12: hostname ? hashDatabaseHostname(hostname) : null,
    currentDatabase: String(identityRows[0]?.current_database ?? "") || null,
    migrationHashes: (ledgerRows as Array<{ hash: unknown }>).map((row) => String(row.hash)),
    presentTables: tableRows.map((row) => String(row.table_name)).sort(),
    alphaClosedEnabled: config?.alpha_closed_enabled === true,
    unlockQuestionId: config?.unlock_question_id
      ? String(config.unlock_question_id)
      : null,
    unlockQuestionActive: config?.unlock_question_active === true,
  };
}

export function buildProductionReadinessReport(input: {
  environment: ProductionEnvironmentSnapshot;
  database: ProductionDatabaseObservation | null;
  requestUrl: string;
  generatedAt?: string;
}): ProductionReadinessReport {
  const { environment, database } = input;
  let requestOrigin: string | null = null;
  let requestHost: string | null = null;
  try {
    const parsed = new URL(input.requestUrl);
    requestOrigin = parsed.origin;
    requestHost = parsed.host;
  } catch {
    requestOrigin = null;
  }

  const authOrigin = canonicalHttpsOrigin(environment.betterAuthUrl);
  const appOrigin = canonicalHttpsOrigin(environment.unstandardAppUrl);
  const missingTables = database
    ? REQUIRED_APPLICATION_TABLES.filter((table) => !database.presentTables.includes(table))
    : [...REQUIRED_APPLICATION_TABLES];

  const gates: ProductionReadinessGate[] = [
    gate(
      "production_target",
      environment.nodeEnv === "production" && environment.vercelEnv === "production",
      "PRODUCTION_TARGET_CONFIRMED",
      "NOT_PRODUCTION_TARGET",
    ),
    gate(
      "database_runtime",
      environment.runtimeMode === "database" && environment.databaseEnv === "production",
      "DATABASE_RUNTIME_CONFIRMED",
      "DATABASE_RUNTIME_MISCONFIGURED",
    ),
    gate(
      "required_secrets",
      environment.hasDatabaseUrl &&
        environment.hasBetterAuthSecret &&
        environment.hasBetterAuthUrl &&
        environment.hasAuthCookieSecret &&
        environment.hasUnstandardAppUrl,
      "REQUIRED_SECRETS_PRESENT",
      "REQUIRED_SECRET_MISSING",
    ),
    gate(
      "canonical_origins",
      Boolean(requestOrigin && authOrigin === requestOrigin && appOrigin === requestOrigin),
      "CANONICAL_ORIGINS_MATCH",
      "CANONICAL_ORIGIN_MISMATCH",
    ),
    gate(
      "release_identity",
      Boolean(environment.releaseSha && /^[a-f0-9]{40}$/iu.test(environment.releaseSha)),
      "RELEASE_SHA_PRESENT",
      "RELEASE_SHA_MISSING_OR_INVALID",
    ),
    gate(
      "database_connectivity",
      Boolean(database?.hostSha12 && database.currentDatabase),
      "DATABASE_CONNECTED",
      "DATABASE_UNAVAILABLE",
    ),
    gate(
      "migration_ledger",
      Boolean(database && arraysEqual(database.migrationHashes, EXPECTED_MIGRATION_HASHES)),
      "MIGRATION_LEDGER_EXACT",
      "MIGRATION_LEDGER_MISMATCH",
    ),
    gate(
      "required_tables",
      Boolean(database && missingTables.length === 0),
      "REQUIRED_TABLES_PRESENT",
      "REQUIRED_TABLE_MISSING",
    ),
    gate(
      "closed_alpha_seed",
      Boolean(database?.alphaClosedEnabled),
      "CLOSED_ALPHA_ENABLED",
      "CLOSED_ALPHA_DISABLED_OR_MISSING",
    ),
    gate(
      "unlock_question",
      Boolean(
        database?.unlockQuestionActive &&
          database.unlockQuestionId === DEFAULT_UNLOCK_QUESTION_ID,
      ),
      "UNLOCK_QUESTION_ACTIVE",
      "UNLOCK_QUESTION_MISSING_OR_INACTIVE",
    ),
  ];

  return {
    artifactVersion: 1,
    kind: "production_readiness",
    ok: gates.every((item) => item.status === "PASS"),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    release: {
      gitSha: environment.releaseSha,
      vercelEnv: environment.vercelEnv,
      requestHost,
    },
    database: {
      hostSha12: database?.hostSha12 ?? null,
      currentDatabase: database?.currentDatabase ?? null,
      migrationCount: database?.migrationHashes.length ?? 0,
      requiredTableCount: database
        ? REQUIRED_APPLICATION_TABLES.length - missingTables.length
        : 0,
    },
    gates,
  };
}
