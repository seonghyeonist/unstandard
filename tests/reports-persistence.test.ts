import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getReportsPersistenceAdapter,
  isReportsPersistenceEnabled,
} from "../lib/config/persistence-mode.ts";
import { mapCreateReportResultToHttp } from "../lib/server/persistence/reports.http-mapper.ts";
import { mapSupabaseReportsRowToRecord } from "../lib/server/persistence/adapters/supabase/reports-row.mapper.ts";
import {
  reportFailure,
  reportSuccess,
} from "../lib/server/persistence/reports.types.ts";

const ENV_KEYS = [
  "REPORTS_PERSISTENCE_ADAPTER",
  "UNSTANDARD_SUPABASE_URL",
  "UNSTANDARD_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    REPORTS_PERSISTENCE_ADAPTER: process.env.REPORTS_PERSISTENCE_ADAPTER,
    UNSTANDARD_SUPABASE_URL: process.env.UNSTANDARD_SUPABASE_URL,
    UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function restoreEnv(snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
): void {
  const snapshot = snapshotEnv();
  for (const key of ENV_KEYS) {
    if (key in overrides) {
      const value = overrides[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
  try {
    run();
  } finally {
    restoreEnv(snapshot);
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

  it("maps missing profile FK to 409", () => {
    const mapped = mapCreateReportResultToHttp(reportFailure("MISSING_PROFILE"));
    assert.equal(mapped.status, 409);
    assert.equal(mapped.body.error, "Profile setup required before reporting");
  });

  it("maps generic DB error to 500 without internal details", () => {
    const mapped = mapCreateReportResultToHttp(reportFailure("DB_ERROR"));
    assert.equal(mapped.status, 500);
    assert.equal(mapped.body.error, "Report submission failed");
    assert.equal(mapped.body.error.includes("23503"), false);
    assert.equal(mapped.body.error.includes("PostgREST"), false);
  });
});

describe("mapSupabaseReportsRowToRecord", () => {
  it("maps snake_case adapter row to ReportRecord", () => {
    const record = mapSupabaseReportsRowToRecord({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      reporter_user_id: "11111111-1111-1111-1111-111111111111",
      target_type: "profile",
      target_id: "c1",
      reason: "closed_alpha_safety_check",
      status: "OPEN",
      created_at: "2026-06-24T00:00:00.000Z",
    });

    assert.equal(record.id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.equal(record.reporterUserId, "11111111-1111-1111-1111-111111111111");
    assert.equal(record.targetType, "profile");
    assert.equal(record.status, "OPEN");
  });

  it("rejects non-OPEN status rows", () => {
    assert.throws(() =>
      mapSupabaseReportsRowToRecord({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        reporter_user_id: "11111111-1111-1111-1111-111111111111",
        target_type: "profile",
        target_id: "c1",
        reason: "closed_alpha_safety_check",
        status: "CLOSED",
        created_at: "2026-06-24T00:00:00.000Z",
      }),
    );
  });
});

describe("reportSuccess", () => {
  it("marks duplicate with duplicate flag", () => {
    const result = reportSuccess("dup-id", false);
    assert.equal(result.ok, true);
    assert.equal(result.inserted, false);
    if (result.ok && !result.inserted) {
      assert.equal(result.duplicate, true);
      assert.equal(result.reportId, "dup-id");
    }
  });
});

describe("reports persistence activation gate", () => {
  it("is disabled when REPORTS_PERSISTENCE_ADAPTER is missing", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "disabled");
        assert.equal(isReportsPersistenceEnabled(), false);
      },
    );
  });

  it("is disabled when REPORTS_PERSISTENCE_ADAPTER=disabled", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: "disabled",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "disabled");
        assert.equal(isReportsPersistenceEnabled(), false);
      },
    );
  });

  it("is disabled when supabase-alpha but Supabase URL/key missing", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: "supabase-alpha",
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "supabase-alpha");
        assert.equal(isReportsPersistenceEnabled(), false);
      },
    );
  });

  it("is disabled when Supabase URL/key present but adapter missing", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: undefined,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "disabled");
        assert.equal(isReportsPersistenceEnabled(), false);
      },
    );
  });

  it("is enabled when supabase-alpha and UNSTANDARD Supabase env present", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: "supabase-alpha",
        UNSTANDARD_SUPABASE_URL: "https://example.supabase.co",
        UNSTANDARD_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "supabase-alpha");
        assert.equal(isReportsPersistenceEnabled(), true);
      },
    );
  });

  it("is disabled for unknown adapter values", () => {
    withEnv(
      {
        REPORTS_PERSISTENCE_ADAPTER: "postgres-prod",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      () => {
        assert.equal(getReportsPersistenceAdapter(), "disabled");
        assert.equal(isReportsPersistenceEnabled(), false);
      },
    );
  });
});
