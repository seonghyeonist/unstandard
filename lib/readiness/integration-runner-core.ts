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
import { assertDatabaseReachable } from "../../tests/integration/helpers";
import { getCurrentGitSha } from "../../lib/readiness/evidence";
import {
  buildIntegrationArtifact,
  writeProofArtifactAtomically,
} from "../../lib/readiness/proof-artifact";
import { REQUIRED_INTEGRATION_CASES } from "../../lib/readiness/proof-constants";
import {
  aggregateIntegrationObservations,
  clearIntegrationCaseLog,
} from "../../lib/readiness/integration-case-log";

export const INTEGRATION_SUITE_DIR = "tests/integration/suite";

export const EXPECTED_INTEGRATION_SUITE_FILES = [
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
  error?: Error;
};

export type SuiteExecutor = (args: {
  files: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
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

export function defaultSuiteExecutor(args: {
  files: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}): SuiteExecutorResult {
  const tsxCli = resolve(args.cwd, "node_modules/tsx/dist/cli.mjs");
  const command = existsSync(tsxCli) ? process.execPath : "npx";
  const commandArgs = existsSync(tsxCli)
    ? [tsxCli, "--test", "--test-concurrency=1", ...args.files]
    : ["tsx", "--test", "--test-concurrency=1", ...args.files];

  const joined = commandArgs.join(" ");
  if (joined.includes("*") || joined.includes("?")) {
    return {
      status: 1,
      error: new Error("suite executor must not use shell wildcards"),
    };
  }

  const result: SpawnSyncReturns<Buffer> = spawnSync(command, commandArgs, {
    cwd: args.cwd,
    env: args.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    return { status: result.status, error: result.error };
  }
  return { status: result.status };
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
      await assertReachable(testUrl);
    } catch {
      throw new IntegrationExecutionError("unable to connect to TEST_DATABASE_URL");
    }
  } else if (deps.assertReachable) {
    await deps.assertReachable(testUrl);
  }

  const caseLogPath = deps.caseLogPath ?? createUniqueObservationLogPath();
  clearIntegrationCaseLog(caseLogPath);

  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    TEST_DATABASE_URL: testUrl,
    DATABASE_ENV: "test",
    UNSTANDARD_INTEGRATION_CASE_LOG: caseLogPath,
  };

  try {
    const files = listIntegrationSuiteFiles(cwd);
    const suiteExecutor = deps.suiteExecutor ?? defaultSuiteExecutor;
    const suiteResult = suiteExecutor({ files, env: childEnv, cwd });
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
      gitSha: getGitSha(),
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
  } finally {
    clearIntegrationCaseLog(caseLogPath);
  }
}

export function mapIntegrationErrorToExitCode(error: unknown): number {
  if (error instanceof ExternalBlockError) return 2;
  if (error instanceof IntegrationExecutionError) return 1;
  return 1;
}
