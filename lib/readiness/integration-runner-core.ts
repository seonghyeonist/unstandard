/**
 * Integration proof runner core.
 *
 * Temporary observation logs must be deleted by normal language control flow
 * (try/finally). After the case log exists, this module must not call
 * process.exit — that bypasses finally and leaks the observation file.
 *
 * Proof suites run serially (--test-concurrency=1) because they share one
 * TEST_DATABASE_URL, one migration surface, and one observation JSONL file.
 * Ordinary unit tests may remain parallel; proof suites must not.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertTestDatabaseEnv } from "../../lib/config/database-env";
import {
  migrationSetChecksum,
  requireDestructiveTestConfirmation,
  requireTestDatabaseUrl,
} from "../../lib/db/migration-guards";
import { getCurrentGitSha } from "../../lib/readiness/evidence";
import { assertDatabaseReachable } from "./integration-database";
import {
  buildIntegrationArtifact,
  writeProofArtifactAtomically,
} from "../../lib/readiness/proof-artifact";
import { REQUIRED_INTEGRATION_CASES } from "../../lib/readiness/proof-constants";
import {
  aggregateIntegrationObservations,
  clearIntegrationCaseLog,
} from "../../lib/readiness/integration-case-log";
import {
  proveIntegrationFixtureBaselineRestored,
  readIntegrationFixtureBaseline,
  type IntegrationFixtureBaseline,
} from "../../lib/readiness/integration-fixture-baseline";

export const INTEGRATION_SUITE_DIR = "tests/integration/suite";
export const INTEGRATION_SUITE_TIMEOUT_MS = 240_000;

export const EXPECTED_INTEGRATION_SUITE_FILES = [
  "tests/integration/suite/db-unlock.test.ts",
  "tests/integration/suite/invites.test.ts",
  "tests/integration/suite/migrations.test.ts",
  "tests/integration/suite/persistence.test.ts",
] as const;

export class ExternalBlockError extends Error {
  readonly code = 2 as const;
  constructor(message: string) {
    super(message);
    this.name = "ExternalBlockError";
  }
}

export class IntegrationExecutionError extends Error {
  readonly code = 1 as const;
  constructor(message: string) {
    super(message);
    this.name = "IntegrationExecutionError";
  }
}

export type IntegrationSuccess = {
  verdict: "PASS";
  caseNames: string[];
  executedFiles: string[];
  outputPath: string | null;
};

export type SuiteExecutorResult = {
  status: number | null;
  signal?: NodeJS.Signals | null;
  errorCode?: string;
  timedOut?: boolean;
  error?: Error;
};

export type SuiteExecutor = (args: {
  files: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  timeoutMs?: number;
}) => SuiteExecutorResult;

export type IntegrationRunnerDeps = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  caseLogPath?: string;
  suiteExecutor?: SuiteExecutor;
  assertReachable?: (url: string) => Promise<void>;
  writeArtifact?: typeof writeProofArtifactAtomically;
  buildArtifact?: typeof buildIntegrationArtifact;
  getGitSha?: () => string;
  migrationChecksum?: () => string;
  readFixtureBaseline?: (url: string) => Promise<IntegrationFixtureBaseline>;
  proveFixtureRestored?: (
    url: string,
    before: IntegrationFixtureBaseline,
  ) => Promise<void>;
  skipPrerequisiteGuards?: boolean;
};

/** Explicit sorted inventory — no shell globbing. */
export function listIntegrationSuiteFiles(cwd = process.cwd()): string[] {
  const absDir = resolve(cwd, INTEGRATION_SUITE_DIR);
  if (!existsSync(absDir)) {
    throw new IntegrationExecutionError(
      `integration suite directory missing: ${INTEGRATION_SUITE_DIR}`,
    );
  }
  const files = readdirSync(absDir)
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => join(INTEGRATION_SUITE_DIR, name).replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new IntegrationExecutionError("integration suite inventory is empty");
  }
  return files;
}

export function createUniqueObservationLogPath(pid = process.pid): string {
  const suffix = randomBytes(8).toString("hex");
  return join(tmpdir(), `unstandard-integration-cases-${pid}-${suffix}.jsonl`);
}

/**
 * Resolve `server-only` to its empty react-server export so integration suites
 * can import server modules under plain Node/tsx (outside Next.js).
 */
export function withReactServerExportCondition(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const childEnv = { ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  const existing = childEnv.NODE_OPTIONS?.trim() ?? "";
  if (/(?:^|\s)--conditions(?:=|\s+)react-server(?:\s|$)/.test(existing)) {
    return childEnv;
  }
  return {
    ...childEnv,
    NODE_OPTIONS: existing
      ? `${existing} --conditions=react-server`
      : "--conditions=react-server",
  };
}

function safeErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,32}$/u.test(code)
    ? code
    : "UNKNOWN";
}

function redactSensitiveOutput(output: string, env: NodeJS.ProcessEnv): string {
  let redacted = output;
  for (const [key, value] of Object.entries(env)) {
    if (
      value &&
      /(?:url|secret|password|token|pepper|api.?key|verification.?code)/iu.test(key)
    ) {
      redacted = redacted.replaceAll(value, "[REDACTED]");
    }
  }
  return redacted
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, "[REDACTED_DATABASE_URL]")
    .replace(
      /((?:password|token|secret|email[_-]?code|verification[_-]?code)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      "$1[REDACTED]",
    );
}

function logSuiteBoundary(
  suite: string,
  phase: "start" | "end",
  details: Record<string, string | number | boolean | null> = {},
): void {
  console.info(JSON.stringify({ event: "integration.suite", suite, phase, ...details }));
}

export function defaultSuiteExecutor(args: {
  files: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  timeoutMs?: number;
}): SuiteExecutorResult {
  const command = process.execPath;
  const timeoutMs = args.timeoutMs ?? INTEGRATION_SUITE_TIMEOUT_MS;
  const commandPrefix = ["--import", "tsx", "--test", "--test-concurrency=1"];

  if (args.files.some((file) => file.includes("*") || file.includes("?"))) {
    return {
      status: 1,
      errorCode: "WILDCARD_SUITE_PATH",
    };
  }

  for (const file of args.files) {
    const startedAt = Date.now();
    const commandArgs = [...commandPrefix, file];
    logSuiteBoundary(file, "start", { timeout_ms: timeoutMs });
    const result: SpawnSyncReturns<string> = spawnSync(command, commandArgs, {
      cwd: args.cwd,
      env: withReactServerExportCondition(args.env),
      encoding: "utf8",
      killSignal: "SIGKILL",
      maxBuffer: 8 * 1024 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    const timedOut = result.error ? safeErrorCode(result.error) === "ETIMEDOUT" : false;
    const errorCode = result.error
      ? timedOut
        ? "SUITE_TIMEOUT"
        : safeErrorCode(result.error)
      : result.status === 0
        ? null
        : "SUITE_NONZERO_EXIT";
    if (result.stdout) {
      process.stdout.write(redactSensitiveOutput(result.stdout, args.env));
    }
    if (result.stderr) {
      process.stderr.write(redactSensitiveOutput(result.stderr, args.env));
    }
    logSuiteBoundary(file, "end", {
      elapsed_ms: Date.now() - startedAt,
      status: result.status,
      signal: result.signal,
      error_code: errorCode,
    });

    if (timedOut || result.error || result.status !== 0) {
      return {
        status: result.status,
        signal: result.signal,
        errorCode: errorCode ?? undefined,
        timedOut,
        error: errorCode ? new Error(errorCode) : undefined,
      };
    }
  }

  return { status: 0, signal: null };
}

function maybeWriteBlockedNote(env: NodeJS.ProcessEnv): void {
  const out = env.UNSTANDARD_INTEGRATION_EVIDENCE_OUT?.trim();
  if (out) {
    console.error(
      "BLOCKED_EXTERNAL: no integration PASS artifact written (credentials/preconditions missing)",
    );
  }
}

/**
 * Production runner-core used by the CLI and by DI tests.
 * After caseLogPath is allocated, failures throw — never process.exit.
 */
export async function runIntegrationProofCore(
  deps: IntegrationRunnerDeps = {},
): Promise<IntegrationSuccess> {
  const cwd = deps.cwd ?? process.cwd();
  const env = { ...(deps.env ?? process.env) };
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    maybeWriteBlockedNote(env);
    throw new ExternalBlockError("TEST_DATABASE_URL missing");
  }

  if (!deps.skipPrerequisiteGuards) {
    try {
      requireTestDatabaseUrl(testUrl);
      assertTestDatabaseEnv();
      requireDestructiveTestConfirmation();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "integration prerequisites failed";
      if (
        message.includes("TEST_DATABASE_URL") ||
        message.includes("UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST")
      ) {
        maybeWriteBlockedNote(env);
        throw new ExternalBlockError(message);
      }
      throw new IntegrationExecutionError(message);
    }

    const assertReachable = deps.assertReachable ?? assertDatabaseReachable;
    try {
      console.info(JSON.stringify({ event: "integration.db_reachability", phase: "start" }));
      await assertReachable(testUrl);
      console.info(JSON.stringify({ event: "integration.db_reachability", phase: "end", outcome: "PASS" }));
    } catch (error) {
      console.info(JSON.stringify({
        event: "integration.db_reachability",
        phase: "end",
        outcome: "FAIL",
        error_code: safeErrorCode(error),
      }));
      throw new IntegrationExecutionError("database reachability failed (DB_REACHABILITY_FAILED)");
    }
  } else if (deps.assertReachable) {
    await deps.assertReachable(testUrl);
  }

  const fixtureGuardEnabled =
    !deps.skipPrerequisiteGuards ||
    Boolean(deps.readFixtureBaseline || deps.proveFixtureRestored);
  const readFixtureBaseline =
    deps.readFixtureBaseline ?? readIntegrationFixtureBaseline;
  let fixtureBaseline: IntegrationFixtureBaseline | null = null;
  if (fixtureGuardEnabled) {
    const startedAt = Date.now();
    console.info(JSON.stringify({ event: "integration.fixture_baseline", phase: "start" }));
    try {
      fixtureBaseline = await readFixtureBaseline(testUrl);
      console.info(JSON.stringify({
        event: "integration.fixture_baseline",
        phase: "end",
        outcome: "PASS",
        elapsed_ms: Date.now() - startedAt,
        counts_only: true,
      }));
    } catch (error) {
      console.info(JSON.stringify({
        event: "integration.fixture_baseline",
        phase: "end",
        outcome: "FAIL",
        elapsed_ms: Date.now() - startedAt,
        error_code: safeErrorCode(error),
      }));
      throw new IntegrationExecutionError("fixture baseline read failed (FIXTURE_BASELINE_FAILED)");
    }
  }

  const caseLogPath = deps.caseLogPath ?? createUniqueObservationLogPath();
  clearIntegrationCaseLog(caseLogPath);

  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    TEST_DATABASE_URL: testUrl,
    DATABASE_ENV: "test",
    UNSTANDARD_TEST_POSTGRES_WEBSOCKET: "yes",
    UNSTANDARD_INTEGRATION_CASE_LOG: caseLogPath,
  };

  let fixtureRestorationAttempted = false;
  let primaryFailure: unknown = null;
  try {
    const files = listIntegrationSuiteFiles(cwd);
    const suiteExecutor = deps.suiteExecutor ?? defaultSuiteExecutor;
    const suiteResult = suiteExecutor({
      files,
      env: childEnv,
      cwd,
      timeoutMs: INTEGRATION_SUITE_TIMEOUT_MS,
    });
    if (suiteResult.timedOut || suiteResult.errorCode === "SUITE_TIMEOUT") {
      throw new IntegrationExecutionError(
        "integration suite timed out (SUITE_TIMEOUT; signal=" +
          (suiteResult.signal ?? "none") +
          ")",
      );
    }
    if (suiteResult.error) {
      throw new IntegrationExecutionError(
        `integration suite failed to start: ${suiteResult.error.message}`,
      );
    }
    if (suiteResult.status !== 0) {
      throw new IntegrationExecutionError(
        `integration suite failed (exit ${suiteResult.status ?? "null"})`,
      );
    }

    if (fixtureBaseline) {
      const proveFixtureRestored =
        deps.proveFixtureRestored ?? proveIntegrationFixtureBaselineRestored;
      const startedAt = Date.now();
      fixtureRestorationAttempted = true;
      console.info(JSON.stringify({ event: "integration.fixture_cleanup", phase: "start" }));
      try {
        await proveFixtureRestored(testUrl, fixtureBaseline);
        console.info(JSON.stringify({
          event: "integration.fixture_cleanup",
          phase: "end",
          outcome: "PASS",
          elapsed_ms: Date.now() - startedAt,
          counts_only: true,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "fixture cleanup failed";
        console.info(JSON.stringify({
          event: "integration.fixture_cleanup",
          phase: "end",
          outcome: "FAIL",
          elapsed_ms: Date.now() - startedAt,
          error_code: safeErrorCode(error),
        }));
        throw new IntegrationExecutionError(`integration fixture cleanup failed: ${message}`);
      }
    }

    const aggregated = aggregateIntegrationObservations(caseLogPath, REQUIRED_INTEGRATION_CASES);
    if (!aggregated.ok) {
      throw new IntegrationExecutionError(
        `integration observation log invalid: ${aggregated.failures.join("; ")}`,
      );
    }

    const anyFail = aggregated.cases.some((item) => item.status === "FAIL");
    if (anyFail) {
      throw new IntegrationExecutionError("one or more required integration cases FAILED");
    }

    const buildArtifact = deps.buildArtifact ?? buildIntegrationArtifact;
    const getGitSha = deps.getGitSha ?? getCurrentGitSha;
    const migrationChecksum = deps.migrationChecksum ?? migrationSetChecksum;

    const built = buildArtifact({
      verdict: "PASS",
      subjectGitSha: getGitSha(),
      migrationChecksum: migrationChecksum(),
      cases: aggregated.cases,
    });

    if (!built.ok) {
      throw new IntegrationExecutionError(
        `integration artifact validation failed: ${built.failures.join("; ")}`,
      );
    }

    const out = env.UNSTANDARD_INTEGRATION_EVIDENCE_OUT?.trim() || null;
    if (out) {
      const writeArtifact = deps.writeArtifact ?? writeProofArtifactAtomically;
      try {
        writeArtifact({
          outputPath: out,
          artifact: built.artifact,
          allowOverwriteDifferentSha: env.UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA === "yes",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "artifact write failed";
        throw new IntegrationExecutionError(`integration artifact write failed: ${message}`);
      }
      console.log(`test:integration PASS artifact written (${out})`);
    } else {
      console.log(
        "test:integration PASS (no UNSTANDARD_INTEGRATION_EVIDENCE_OUT — artifact not written)",
      );
    }

    console.log(
      JSON.stringify(
        {
          verdict: "PASS",
          kind: "integration",
          matrix: "real_postgresql_integration",
          note: "Real PostgreSQL integration evidence only — not Neon Production evidence",
          caseNames: aggregated.cases.map((item) => item.name),
          executedFiles: files,
          concurrency: 1,
        },
        null,
        2,
      ),
    );

    return {
      verdict: "PASS",
      caseNames: aggregated.cases.map((item) => item.name),
      executedFiles: files,
      outputPath: out,
    };
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      if (fixtureBaseline && !fixtureRestorationAttempted) {
        fixtureRestorationAttempted = true;
        const proveFixtureRestored =
          deps.proveFixtureRestored ?? proveIntegrationFixtureBaselineRestored;
        const startedAt = Date.now();
        console.info(JSON.stringify({
          event: "integration.fixture_cleanup",
          phase: "start",
          failure_path: true,
        }));
        try {
          await proveFixtureRestored(testUrl, fixtureBaseline);
          console.info(JSON.stringify({
            event: "integration.fixture_cleanup",
            phase: "end",
            outcome: "PASS",
            elapsed_ms: Date.now() - startedAt,
            counts_only: true,
            failure_path: true,
          }));
        } catch (error) {
          console.info(JSON.stringify({
            event: "integration.fixture_cleanup",
            phase: "end",
            outcome: "FAIL",
            elapsed_ms: Date.now() - startedAt,
            error_code: safeErrorCode(error),
            counts_only: true,
            failure_path: true,
          }));
          if (primaryFailure === null) {
            const message = error instanceof Error ? error.message : "fixture cleanup failed";
            throw new IntegrationExecutionError(
              `integration fixture cleanup failed after runner exit: ${message}`,
            );
          }
        }
      }
    } finally {
      console.info(JSON.stringify({ event: "integration.observation_log_cleanup", phase: "start" }));
      clearIntegrationCaseLog(caseLogPath);
      console.info(JSON.stringify({ event: "integration.observation_log_cleanup", phase: "end" }));
    }
  }
}

export function mapIntegrationErrorToExitCode(error: unknown): number {
  if (error instanceof ExternalBlockError) return 2;
  if (error instanceof IntegrationExecutionError) return 1;
  return 1;
}
