import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getReportsPersistenceAdapter,
  isReportsPersistenceEnabled,
} from "../lib/config/persistence-mode.ts";
import { mapCreateReportResultToHttp } from "../lib/server/persistence/reports.http-mapper.ts";
import { mapReportRowToRecord } from "../lib/server/persistence/reports-row.mapper.ts";
import { reportFailure, reportSuccess } from "../lib/server/persistence/reports.types.ts";

const ENV_KEYS = ["UNSTANDARD_RUNTIME_MODE", "DATABASE_URL"] as const;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;

  for (const key of ENV_KEYS) {
    if (key in overrides) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("mapCreateReportResultToHttp", () => {
  it("maps new report to 201", () => {
    const mapped = mapCreateReportResultToHttp(reportSuccess("report-id", true));
    assert.equal(mapped.status, 201);
    assert.deepEqual(mapped.body, { ok: true, id: "report-id" });
  });

  it("maps duplicate OPEN report to 200", () => {
    const mapped = mapCreateReportResultToHttp(reportSuccess("existing-id", false));
    assert.equal(mapped.status, 200);
    assert.deepEqual(mapped.body, { ok: true, id: "existing-id" });
  });

  it("maps persistence disabled to 503", () => {
    const mapped = mapCreateReportResultToHttp(reportFailure("PERSISTENCE_DISABLED"));
    assert.equal(mapped.status, 503);
    assert.equal(mapped.body.error, "Report persistence unavailable");
  });
});

describe("mapReportRowToRecord", () => {
  it("maps adapter row to ReportRecord", () => {
    const record = mapReportRowToRecord({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      reporterUserId: "11111111-1111-1111-1111-111111111111",
      targetType: "profile",
      targetId: "c1",
      reason: "closed_alpha_safety_check",
      status: "OPEN",
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    assert.equal(record.id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.equal(record.reporterUserId, "11111111-1111-1111-1111-111111111111");
    assert.equal(record.targetType, "profile");
    assert.equal(record.status, "OPEN");
  });
});

describe("reports persistence activation gate", () => {
  it("is disabled when runtime mode is mock", () => {
    withEnv({ UNSTANDARD_RUNTIME_MODE: "mock", DATABASE_URL: "postgres://test" }, () => {
      assert.equal(getReportsPersistenceAdapter(), "disabled");
      assert.equal(isReportsPersistenceEnabled(), false);
    });
  });

  it("is enabled when database runtime and DATABASE_URL are set", () => {
    withEnv(
      { UNSTANDARD_RUNTIME_MODE: "database", DATABASE_URL: "postgres://test" },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "postgres");
        assert.equal(isReportsPersistenceEnabled(), true);
      },
    );
  });
});
