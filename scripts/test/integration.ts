import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

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
  clearIntegrationCaseLog,
  readObservedIntegrationCases,
} from "../../lib/readiness/integration-case-log";

function blocked(message: string): never {
  console.error(`BLOCKED_EXTERNAL: ${message}`);
  process.exit(2);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function maybeWriteBlockedNote(): void {
  // Intentionally never writes a PASS artifact on blocked runs.
  const out = process.env.UNSTANDARD_INTEGRATION_EVIDENCE_OUT?.trim();
  if (out) {
    console.error(
      "BLOCKED_EXTERNAL: no integration PASS artifact written (credentials/preconditions missing)",
    );
  }
}

async function main(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    maybeWriteBlockedNote();
    blocked("TEST_DATABASE_URL missing");
  }

  try {
    requireTestDatabaseUrl(testUrl);
    assertTestDatabaseEnv();
    requireDestructiveTestConfirmation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "integration prerequisites failed";
    if (message.includes("TEST_DATABASE_URL") || message.includes("UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST")) {
      maybeWriteBlockedNote();
      blocked(message);
    }
    fail(message);
  }

  try {
    await assertDatabaseReachable(testUrl);
  } catch {
    fail("unable to connect to TEST_DATABASE_URL");
  }

  const caseLogPath = join(tmpdir(), `unstandard-integration-cases-${process.pid}.jsonl`);
  clearIntegrationCaseLog(caseLogPath);

  const env = {
    ...process.env,
    TEST_DATABASE_URL: testUrl,
    DATABASE_ENV: "test",
    UNSTANDARD_INTEGRATION_CASE_LOG: caseLogPath,
  };

  try {
    execSync("tsx --test tests/integration/suite/*.test.ts", {
      env,
      stdio: "inherit",
    });
  } catch {
    fail("integration suite failed");
  }

  const observed = readObservedIntegrationCases(caseLogPath);
  const byName = new Map(observed.map((item) => [item.name, item.status]));
  const cases = REQUIRED_INTEGRATION_CASES.map((name) => {
    const status = byName.get(name);
    if (!status) {
      return { name, status: "FAIL" as const };
    }
    return { name, status };
  });

  const missing = cases.filter((item) => !byName.has(item.name));
  if (missing.length > 0) {
    fail(
      `required integration assertions were not observed: ${missing.map((item) => item.name).join(", ")}`,
    );
  }

  const anyFail = cases.some((item) => item.status === "FAIL");
  if (anyFail) {
    fail("one or more required integration cases FAILED");
  }

  const built = buildIntegrationArtifact({
    verdict: "PASS",
    gitSha: getCurrentGitSha(),
    migrationChecksum: migrationSetChecksum(),
    cases,
  });

  if (!built.ok) {
    fail(`integration artifact validation failed: ${built.failures.join("; ")}`);
  }

  const out = process.env.UNSTANDARD_INTEGRATION_EVIDENCE_OUT?.trim();
  if (out) {
    writeProofArtifactAtomically({
      outputPath: out,
      artifact: built.artifact,
      allowOverwriteDifferentSha: process.env.UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA === "yes",
    });
    console.log(`test:integration PASS artifact written (${out})`);
  } else {
    console.log("test:integration PASS (no UNSTANDARD_INTEGRATION_EVIDENCE_OUT — artifact not written)");
  }

  console.log(
    JSON.stringify(
      {
        verdict: "PASS",
        kind: "integration",
        matrix: "real_postgresql_integration",
        note: "Real PostgreSQL integration evidence only — not Neon Production evidence",
        caseNames: cases.map((item) => item.name),
      },
      null,
      2,
    ),
  );

  clearIntegrationCaseLog(caseLogPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "integration runner failed";
  if (message.includes("BLOCKED_EXTERNAL")) {
    maybeWriteBlockedNote();
    blocked(message.replace("BLOCKED_EXTERNAL: ", ""));
  }
  fail(message);
});
