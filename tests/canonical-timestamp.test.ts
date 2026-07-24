import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalProofTimestamp,
  isCanonicalProofTimestamp,
  nowCanonicalProofTimestamp,
} from "../lib/readiness/canonical-timestamp";
import { parseIntegrationProofArtifact } from "../lib/readiness/proof-artifact";
import { REQUIRED_INTEGRATION_CASES } from "../lib/readiness/proof-constants";

const GIT_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHECKSUM = "0123456789abcdef";
const NOW = Date.parse("2026-07-14T06:00:00.000Z");

describe("canonical proof timestamp", () => {
  it("accepts Date.toISOString() form", () => {
    const value = nowCanonicalProofTimestamp(NOW);
    assert.equal(value, "2026-07-14T06:00:00.000Z");
    assert.equal(isCanonicalProofTimestamp(value), true);
    assert.equal(assertCanonicalProofTimestamp(value), value);
  });

  it("rejects human-readable date", () => {
    assert.equal(isCanonicalProofTimestamp("July 14, 2026"), false);
  });

  it("rejects date-only", () => {
    assert.equal(isCanonicalProofTimestamp("2026-07-14"), false);
  });

  it("rejects no-millisecond timestamp", () => {
    assert.equal(isCanonicalProofTimestamp("2026-07-14T06:00:00Z"), false);
  });

  it("rejects offset timestamp", () => {
    assert.equal(isCanonicalProofTimestamp("2026-07-14T06:00:00.000+09:00"), false);
  });

  it("rejects impossible date via round-trip inequality", () => {
    assert.equal(isCanonicalProofTimestamp("2026-02-30T06:00:00.000Z"), false);
  });

  it("rejects stale artifact timestamps", () => {
    const parsed = parseIntegrationProofArtifact(
      {
        artifactVersion: 1,
        kind: "integration",
        verdict: "PASS",
        gitSha: GIT_SHA,
        migrationChecksum: CHECKSUM,
        timestamp: "2020-01-01T00:00:00.000Z",
        matrix: "real_postgresql_integration",
        cases: REQUIRED_INTEGRATION_CASES.map((name) => ({ name, status: "PASS" })),
      },
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects excessive future timestamps", () => {
    const parsed = parseIntegrationProofArtifact(
      {
        artifactVersion: 1,
        kind: "integration",
        verdict: "PASS",
        gitSha: GIT_SHA,
        migrationChecksum: CHECKSUM,
        timestamp: "2099-01-01T00:00:00.000Z",
        matrix: "real_postgresql_integration",
        cases: REQUIRED_INTEGRATION_CASES.map((name) => ({ name, status: "PASS" })),
      },
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects space-separated datetime that Date.parse accepts", () => {
    assert.equal(isCanonicalProofTimestamp("2026-07-14 06:00:00"), false);
  });
});
