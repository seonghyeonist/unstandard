import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  aggregateIntegrationObservations,
  clearIntegrationCaseLog,
} from "../lib/readiness/integration-case-log";

const REQUIRED = ["report_user_fk", "seed_idempotency"] as const;

function writeLog(dir: string, lines: string[]): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "cases.jsonl");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

describe("integration observation log", () => {
  it("rejects missing observation", () => {
    const dir = join(tmpdir(), `obs-missing-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.includes("missing") && f.includes("seed_idempotency")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate PASS observation", () => {
    const dir = join(tmpdir(), `obs-dup-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.includes("duplicate") && f.includes("report_user_fk")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects PASS then FAIL duplicate (FAIL preserved in cases)", () => {
    const dir = join(tmpdir(), `obs-pf-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "report_user_fk", status: "FAIL" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.includes("duplicate")));
      const report = result.cases.find((c) => c.name === "report_user_fk");
      assert.equal(report?.status, "FAIL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects FAIL then PASS duplicate (does not overwrite FAIL with PASS semantically under dup reject)", () => {
    const dir = join(tmpdir(), `obs-fp-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "FAIL" }),
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      const report = result.cases.find((c) => c.name === "report_user_fk");
      assert.equal(report?.status, "FAIL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed JSONL line", () => {
    const dir = join(tmpdir(), `obs-bad-${process.pid}`);
    try {
      const path = writeLog(dir, [
        "{not-json",
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.includes("malformed")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects unknown case", () => {
    const dir = join(tmpdir(), `obs-unknown-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
        JSON.stringify({ name: "not_a_real_case", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.includes("unknown")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cleanup removes observation log after failure path", () => {
    const dir = join(tmpdir(), `obs-cleanup-${process.pid}`);
    const path = writeLog(dir, [JSON.stringify({ name: "report_user_fk", status: "PASS" })]);
    assert.equal(existsSync(path), true);
    try {
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, false);
    } finally {
      clearIntegrationCaseLog(path);
      assert.equal(existsSync(path), false);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts exact single PASS observations", () => {
    const dir = join(tmpdir(), `obs-ok-${process.pid}`);
    try {
      const path = writeLog(dir, [
        JSON.stringify({ name: "report_user_fk", status: "PASS" }),
        JSON.stringify({ name: "seed_idempotency", status: "PASS" }),
      ]);
      const result = aggregateIntegrationObservations(path, REQUIRED);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.cases.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
