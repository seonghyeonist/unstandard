import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPersistenceEnabled } from "../lib/config/persistence-mode.ts";
import { mapCreateReportResultToHttp } from "../lib/server/persistence/reports.http-mapper.ts";
import { mapSupabaseReportsRowToRecord } from "../lib/server/persistence/adapters/supabase/reports-row.mapper.ts";
import {
  reportFailure,
  reportSuccess,
} from "../lib/server/persistence/reports.types.ts";

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

describe("isPersistenceEnabled", () => {
  it("is false when alpha adapter env is missing", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      assert.equal(isPersistenceEnabled(), false);
    } finally {
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });
});
