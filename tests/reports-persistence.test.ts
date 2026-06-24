import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPersistenceEnabled } from "../lib/config/persistence-mode.ts";
import {
  PersistenceNotConfiguredError,
  mapReportsRowToRecord,
  resolveCreateOrGetOpenReport,
  resolveReportCreatedStatus,
} from "../lib/server/persistence/reports.mapper.ts";

describe("mapReportsRowToRecord", () => {
  it("maps snake_case DB row to ReportRecord", () => {
    const record = mapReportsRowToRecord({
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
    assert.equal(record.targetId, "c1");
    assert.equal(record.status, "OPEN");
  });

  it("rejects non-OPEN status rows", () => {
    assert.throws(() =>
      mapReportsRowToRecord({
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

describe("resolveCreateOrGetOpenReport", () => {
  const created = {
    id: "new-id",
    reporterUserId: "11111111-1111-1111-1111-111111111111",
    targetType: "profile" as const,
    targetId: "c1",
    reason: "spam",
    createdAt: "2026-06-24T00:00:00.000Z",
    status: "OPEN" as const,
  };

  const existing = { ...created, id: "existing-id" };

  it("returns existing report when duplicate OPEN report exists", () => {
    const result = resolveCreateOrGetOpenReport(existing, created);
    assert.equal(result.created, false);
    assert.equal(result.record.id, "existing-id");
  });

  it("returns created report when no duplicate exists", () => {
    const result = resolveCreateOrGetOpenReport(null, created);
    assert.equal(result.created, true);
    assert.equal(result.record.id, "new-id");
  });
});

describe("resolveReportCreatedStatus", () => {
  it("returns false when insert was skipped due to 23505 race recovery", () => {
    assert.equal(resolveReportCreatedStatus(false), false);
  });

  it("returns true only on successful insert", () => {
    assert.equal(resolveReportCreatedStatus(true), true);
  });
});

describe("PersistenceNotConfiguredError", () => {
  it("is identifiable for 503 mapping", () => {
    const error = new PersistenceNotConfiguredError();
    assert.equal(error.name, "PersistenceNotConfiguredError");
  });
});

describe("isPersistenceEnabled", () => {
  it("is false when Supabase env is missing", () => {
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
