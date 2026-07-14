import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { REQUIRED_INTEGRATION_CASES } from "../lib/readiness/proof-constants";
import {
  EXPECTED_INTEGRATION_SUITE_FILES,
  IntegrationExecutionError,
  createUniqueObservationLogPath,
  defaultSuiteExecutor,
  listIntegrationSuiteFiles,
  runIntegrationProofCore,
} from "../lib/readiness/integration-runner-core";

const VALID_SHA = "a".repeat(40);
const VALID_CHECKSUM = "b".repeat(16);

describe("integration runner-core termination and serial execution", () => {
  it("lists an explicit sorted inventory containing expected suite files", () => {
    const files = listIntegrationSuiteFiles();
    assert.deepEqual(files, [...files].sort((a, b) => a.localeCompare(b)));
    for (const expected of EXPECTED_INTEGRATION_SUITE_FILES) {
      assert.ok(files.includes(expected), `missing ${expected}`);
    }
  });

  it("fails on empty inventory", () => {
    const emptyRoot = join(tmpdir(), `empty-root-${process.pid}-${Date.now()}`);
    mkdirSync(join(emptyRoot, "tests", "integration", "suite"), { recursive: true });
    try {
      assert.throws(
        () => listIntegrationSuiteFiles(emptyRoot),
        (error: unknown) =>
          error instanceof IntegrationExecutionError && /empty/i.test(error.message),
      );
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("defaultSuiteExecutor and runner-core use shell:false, concurrency 1, no wildcards, no process.exit", () => {
    const result = defaultSuiteExecutor({
      files: ["tests/integration/suite/migrations.test.ts"],
      env: { ...process.env, TEST_DATABASE_URL: "" },
      cwd: process.cwd(),
    });
    assert.ok(result.status !== undefined);
    const source = readFileSync(
      join(process.cwd(), "lib/readiness/integration-runner-core.ts"),
      "utf8",
    );
    assert.match(source, /--test-concurrency=1/);
    assert.match(source, /shell:\s*false/);
    assert.doesNotMatch(source, /suite\/\*\.test\.ts/);
    assert.doesNotMatch(source, /execSync\(/);
    assert.doesNotMatch(source, /process\.exit\(/);

    const cli = readFileSync(join(process.cwd(), "scripts/test/integration.ts"), "utf8");
    assert.match(cli, /process\.exitCode/);
    assert.doesNotMatch(cli, /process\.exit\(/);
  });

  it("failure after log creation deletes the observation log (DI)", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    writeFileSync(caseLogPath, "", "utf8");
    assert.equal(existsSync(caseLogPath), true);

    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "postgresql://example.invalid/db",
          },
          skipPrerequisiteGuards: true,
          suiteExecutor: ({ env }) => {
            const path = env.UNSTANDARD_INTEGRATION_CASE_LOG;
            assert.ok(path);
            writeFileSync(
              path,
              `${JSON.stringify({ name: "report_user_fk", status: "PASS" })}\n`,
              "utf8",
            );
            assert.equal(existsSync(path), true);
            return { status: 1 };
          },
        }),
      (error: unknown) =>
        error instanceof IntegrationExecutionError && /suite failed/i.test(error.message),
    );

    assert.equal(existsSync(caseLogPath), false);
  });

  it("observation aggregation failure deletes the log", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "postgresql://example.invalid/db",
          },
          skipPrerequisiteGuards: true,
          suiteExecutor: ({ env }) => {
            writeFileSync(
              env.UNSTANDARD_INTEGRATION_CASE_LOG!,
              `${JSON.stringify({ name: "report_user_fk", status: "PASS" })}\n`,
              "utf8",
            );
            return { status: 0 };
          },
        }),
      IntegrationExecutionError,
    );
    assert.equal(existsSync(caseLogPath), false);
  });

  it("artifact validation failure deletes the log", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    const lines = REQUIRED_INTEGRATION_CASES.map((name) =>
      JSON.stringify({ name, status: "PASS" }),
    );
    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "postgresql://example.invalid/db",
          },
          skipPrerequisiteGuards: true,
          suiteExecutor: ({ env }) => {
            writeFileSync(env.UNSTANDARD_INTEGRATION_CASE_LOG!, `${lines.join("\n")}\n`, "utf8");
            return { status: 0 };
          },
          buildArtifact: () => ({
            ok: false as const,
            failures: ["forced artifact validation failure"],
          }),
        }),
      (error: unknown) =>
        error instanceof IntegrationExecutionError &&
        /artifact validation failed/i.test((error as Error).message),
    );
    assert.equal(existsSync(caseLogPath), false);
  });

  it("artifact write failure deletes the log", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    const lines = REQUIRED_INTEGRATION_CASES.map((name) =>
      JSON.stringify({ name, status: "PASS" }),
    );
    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "postgresql://example.invalid/db",
            UNSTANDARD_INTEGRATION_EVIDENCE_OUT: join(tmpdir(), "should-fail.json"),
          },
          skipPrerequisiteGuards: true,
          suiteExecutor: ({ env }) => {
            writeFileSync(env.UNSTANDARD_INTEGRATION_CASE_LOG!, `${lines.join("\n")}\n`, "utf8");
            return { status: 0 };
          },
          getGitSha: () => VALID_SHA,
          migrationChecksum: () => VALID_CHECKSUM,
          writeArtifact: () => {
            throw new Error("disk full");
          },
        }),
      (error: unknown) =>
        error instanceof IntegrationExecutionError &&
        /artifact write failed/i.test((error as Error).message),
    );
    assert.equal(existsSync(caseLogPath), false);
  });

  it("success deletes the observation log", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    const lines = REQUIRED_INTEGRATION_CASES.map((name) =>
      JSON.stringify({ name, status: "PASS" }),
    );
    const result = await runIntegrationProofCore({
      caseLogPath,
      env: {
        ...process.env,
        TEST_DATABASE_URL: "postgresql://example.invalid/db",
      },
      skipPrerequisiteGuards: true,
      suiteExecutor: ({ env }) => {
        writeFileSync(env.UNSTANDARD_INTEGRATION_CASE_LOG!, `${lines.join("\n")}\n`, "utf8");
        return { status: 0 };
      },
      getGitSha: () => VALID_SHA,
      migrationChecksum: () => VALID_CHECKSUM,
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(existsSync(caseLogPath), false);
  });
});
