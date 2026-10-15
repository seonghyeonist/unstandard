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

  it("defaultSuiteExecutor runs a real child test and keeps the runner bounded", () => {
    const smokeSuite = join(
      tmpdir(),
      "unstandard-runner-smoke-" + process.pid + "-" + Date.now() + ".test.cjs",
    );
    writeFileSync(
      smokeSuite,
      "const test = require('node:test'); test('child suite executed', () => {});\n",
      "utf8",
    );
    try {
      const result = defaultSuiteExecutor({
        files: [smokeSuite],
        env: { ...process.env, TEST_DATABASE_URL: "" },
        cwd: process.cwd(),
        timeoutMs: 5_000,
      });
      assert.equal(result.status, 0);
    } finally {
      rmSync(smokeSuite, { force: true });
    }

    const source = readFileSync(
      join(process.cwd(), "lib/readiness/integration-runner-core.ts"),
      "utf8",
    );
    assert.match(source, /--test-concurrency=1/);
    assert.match(source, /shell:\s*false/);
    assert.match(source, /--conditions=react-server/);
    assert.match(source, /withReactServerExportCondition/);
    assert.doesNotMatch(source, /suite\/\*\.test\.ts/);
    assert.doesNotMatch(source, /execSync\(/);
    assert.doesNotMatch(source, /process\.exit\(/);
    assert.match(source, /--import/);
    assert.doesNotMatch(source, /tsx\/dist\/cli\.mjs/);

    const cli = readFileSync(join(process.cwd(), "scripts/test/integration.ts"), "utf8");
    assert.match(cli, /process\.exitCode/);
    assert.doesNotMatch(cli, /process\.exit\(/);
  });

  it("kills a suite child at its hard timeout and records the signal", () => {
    const hangingSuite = join(
      tmpdir(),
      "unstandard-hanging-suite-" + process.pid + "-" + Date.now() + ".test.js",
    );
    writeFileSync(hangingSuite, "setInterval(() => {}, 1000);\n", "utf8");
    try {
      const result = defaultSuiteExecutor({
        files: [hangingSuite],
        env: { ...process.env, TEST_DATABASE_URL: "test-db-url" },
        cwd: process.cwd(),
        timeoutMs: 500,
      });
      assert.equal(result.timedOut, true);
      assert.equal(result.errorCode, "SUITE_TIMEOUT");
      assert.equal(result.signal, "SIGKILL");
      assert.equal(result.status, null);
    } finally {
      rmSync(hangingSuite, { force: true });
    }

    const supervisor = readFileSync(
      join(process.cwd(), "scripts/test/integration-supervisor.ts"),
      "utf8",
    );
    assert.match(supervisor, /SUPERVISOR_TIMEOUT_MS/);
    assert.match(supervisor, /killSignal:\s*"SIGKILL"/);
    assert.match(supervisor, /integration\.process_exit/);
  });

  it("failure after log creation verifies fixture restoration and deletes the observation log (DI)", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    writeFileSync(caseLogPath, "", "utf8");
    assert.equal(existsSync(caseLogPath), true);
    let restorationChecks = 0;
    let artifactWritten = false;

    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "test-db-url",
            UNSTANDARD_INTEGRATION_EVIDENCE_OUT: join(tmpdir(), "must-not-write-after-suite-failure.json"),
          },
          skipPrerequisiteGuards: true,
          readFixtureBaseline: async () => ({ users: 0, profiles: 0, alpha_invites: 0 }),
          proveFixtureRestored: async () => {
            restorationChecks += 1;
          },
          suiteExecutor: ({ env }) => {
            assert.equal(env.UNSTANDARD_TEST_POSTGRES_WEBSOCKET, "yes");
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
          writeArtifact: () => {
            artifactWritten = true;
          },
        }),
      (error: unknown) =>
        error instanceof IntegrationExecutionError && /suite failed/i.test(error.message),
    );

    assert.equal(restorationChecks, 1);
    assert.equal(artifactWritten, false);
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
            TEST_DATABASE_URL: "test-db-url",
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

  it("fixture drift blocks PASS artifact creation and deletes the log", async () => {
    const caseLogPath = createUniqueObservationLogPath();
    const lines = REQUIRED_INTEGRATION_CASES.map((name) =>
      JSON.stringify({ name, status: "PASS" }),
    );
    let artifactWritten = false;

    await assert.rejects(
      () =>
        runIntegrationProofCore({
          caseLogPath,
          env: {
            ...process.env,
            TEST_DATABASE_URL: "test-db-url",
            UNSTANDARD_INTEGRATION_EVIDENCE_OUT: join(tmpdir(), "must-not-exist.json"),
          },
          skipPrerequisiteGuards: true,
          readFixtureBaseline: async () => ({
            users: 5,
            profiles: 5,
            alpha_invites: 12,
          }),
          proveFixtureRestored: async () => {
            throw new Error("users before=5 after=12");
          },
          suiteExecutor: ({ env }) => {
            writeFileSync(env.UNSTANDARD_INTEGRATION_CASE_LOG!, `${lines.join("\n")}\n`, "utf8");
            return { status: 0 };
          },
          writeArtifact: () => {
            artifactWritten = true;
          },
        }),
      (error: unknown) =>
        error instanceof IntegrationExecutionError &&
        /integration fixture cleanup failed: users before=5 after=12/u.test(error.message),
    );

    assert.equal(artifactWritten, false);
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
            TEST_DATABASE_URL: "test-db-url",
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
            TEST_DATABASE_URL: "test-db-url",
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
        TEST_DATABASE_URL: "test-db-url",
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
