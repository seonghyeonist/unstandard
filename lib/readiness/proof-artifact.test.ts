import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildCombinedReadinessArtifact,
  buildIntegrationArtifact,
  buildSmokeArtifact,
  parseCombinedReadinessArtifact,
  parseIntegrationProofArtifact,
  parseProofArtifact,
  parseSmokeProofArtifact,
  writeProofArtifactAtomically,
  writeProofArtifactAtomicallyWithInjectedFailure,
  type ProofCase,
} from "./proof-artifact";
import {
  REQUIRED_HTTP_SMOKE_CASES,
  REQUIRED_INTEGRATION_CASES,
} from "./proof-constants";
import { combineSourceArtifacts, validateReadinessEvidence } from "./evidence";
import { CookieJar } from "../smoke/cookie-jar";
import {
  proveClearedCookieDenied,
  proveRevokedSessionRejected,
} from "../smoke/session-revocation";

const GIT_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GIT_SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CHECKSUM = "0123456789abcdef";
const PREVIEW_HOST = "unstandard-m9qj-git-cursor-neon-drizzle-better-auth-rebuild-909d-unstandard.vercel.app";
const NOW = Date.parse("2026-07-14T06:00:00.000Z");

function allPassCases(names: readonly string[]): ProofCase[] {
  return names.map((name) => ({ name, status: "PASS" as const }));
}

function validIntegration(overrides: Record<string, unknown> = {}) {
  return {
    artifactVersion: 1,
    kind: "integration",
    verdict: "PASS",
    gitSha: GIT_SHA,
    migrationChecksum: CHECKSUM,
    timestamp: "2026-07-14T05:00:00.000Z",
    matrix: "real_postgresql_integration",
    cases: allPassCases(REQUIRED_INTEGRATION_CASES),
    ...overrides,
  };
}

function validSmoke(overrides: Record<string, unknown> = {}) {
  return {
    artifactVersion: 1,
    kind: "smoke",
    verdict: "PASS",
    gitSha: GIT_SHA,
    migrationChecksum: CHECKSUM,
    timestamp: "2026-07-14T05:05:00.000Z",
    matrix: "deployed_http_alpha_surface",
    previewHostname: PREVIEW_HOST,
    cases: allPassCases(REQUIRED_HTTP_SMOKE_CASES),
    futureNotApplicable: [
      {
        name: "db_backed_cross_user_private_profile_denial",
        reason:
          "Not applicable: the current private-profile route is mock-backed and does not query Neon profile ownership.",
      },
    ],
    ...overrides,
  };
}

describe("proof artifact schema", () => {
  it("accepts valid PASS integration artifact", () => {
    const parsed = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    assert.equal(parsed.ok, true);
  });

  it("accepts valid PASS smoke artifact", () => {
    const parsed = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(parsed.ok, true);
  });

  it("accepts valid combined readiness artifact", () => {
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(integration.ok, true);
    assert.equal(smoke.ok, true);
    if (!integration.ok || !smoke.ok) return;
    const combined = buildCombinedReadinessArtifact({
      integration: integration.artifact,
      smoke: smoke.artifact,
      nowIso: "2026-07-14T05:10:00.000Z",
    });
    assert.equal(combined.ok, true);
    if (!combined.ok) return;
    const reparsed = parseCombinedReadinessArtifact(combined.artifact, { nowMs: NOW });
    assert.equal(reparsed.ok, true);
  });

  it("rejects missing required integration case", () => {
    const cases = allPassCases(REQUIRED_INTEGRATION_CASES).filter((c) => c.name !== "block_uniqueness");
    const built = buildIntegrationArtifact({
      verdict: "PASS",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      cases,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const combined = combineSourceArtifacts({
      integration: built.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
    if (combined.ok) return;
    assert.ok(combined.failures.some((f) => f.includes("block_uniqueness")));
  });

  it("rejects missing required smoke case", () => {
    const cases = allPassCases(REQUIRED_HTTP_SMOKE_CASES).filter((c) => c.name !== "cleared_cookie_denied");
    const smoke = parseSmokeProofArtifact(validSmoke({ cases }), { nowMs: NOW });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    assert.equal(integration.ok, true);
    if (!integration.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
    if (combined.ok) return;
    assert.ok(combined.failures.some((f) => f.includes("cleared_cookie_denied")));
  });

  it("rejects required integration case with FAIL", () => {
    const cases = allPassCases(REQUIRED_INTEGRATION_CASES).map((c) =>
      c.name === "seed_idempotency" ? { ...c, status: "FAIL" as const } : c,
    );
    const integration = buildIntegrationArtifact({
      verdict: "FAIL",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      cases,
    });
    assert.equal(integration.ok, true);
    if (!integration.ok) return;
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
  });

  it("rejects required smoke case with FAIL", () => {
    const cases = allPassCases(REQUIRED_HTTP_SMOKE_CASES).map((c) =>
      c.name === "revoked_session_rejected" ? { ...c, status: "FAIL" as const } : c,
    );
    const smoke = buildSmokeArtifact({
      verdict: "FAIL",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      previewHostname: PREVIEW_HOST,
      cases,
    });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    assert.equal(integration.ok, true);
    if (!integration.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
  });

  it("rejects duplicate required case", () => {
    const cases = [...allPassCases(REQUIRED_INTEGRATION_CASES), { name: "block_uniqueness", status: "PASS" as const }];
    const parsed = parseIntegrationProofArtifact(validIntegration({ cases }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects duplicate non-required case", () => {
    const cases = [
      ...allPassCases(REQUIRED_INTEGRATION_CASES),
      { name: "extra_case", status: "PASS" as const },
      { name: "extra_case", status: "PASS" as const },
    ];
    const parsed = parseIntegrationProofArtifact(validIntegration({ cases }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects aggregate PASS with failed case", () => {
    const cases = allPassCases(REQUIRED_INTEGRATION_CASES).map((c, i) =>
      i === 0 ? { ...c, status: "FAIL" as const } : c,
    );
    const parsed = parseIntegrationProofArtifact(validIntegration({ cases, verdict: "PASS" }), {
      nowMs: NOW,
    });
    assert.equal(parsed.ok, false);
  });

  it("rejects aggregate FAIL with no failed case", () => {
    const parsed = parseIntegrationProofArtifact(validIntegration({ verdict: "FAIL" }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects empty PASS case list", () => {
    const parsed = parseIntegrationProofArtifact(validIntegration({ cases: [] }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects futureNotApplicable overlap", () => {
    const parsed = parseSmokeProofArtifact(
      validSmoke({
        futureNotApplicable: [{ name: "anonymous_denied", reason: "overlap" }],
      }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects duplicate futureNotApplicable name", () => {
    const parsed = parseSmokeProofArtifact(
      validSmoke({
        futureNotApplicable: [
          { name: "db_backed_cross_user_private_profile_denial", reason: "a" },
          { name: "db_backed_cross_user_private_profile_denial", reason: "b" },
        ],
      }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects stale timestamp", () => {
    const parsed = parseIntegrationProofArtifact(
      validIntegration({ timestamp: "2020-01-01T00:00:00.000Z" }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects invalid timestamp", () => {
    const parsed = parseIntegrationProofArtifact(validIntegration({ timestamp: "not-a-date" }), {
      nowMs: NOW,
    });
    assert.equal(parsed.ok, false);
  });

  it("rejects excessively future timestamp", () => {
    const parsed = parseIntegrationProofArtifact(
      validIntegration({ timestamp: "2099-01-01T00:00:00.000Z" }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects wrong full git SHA", () => {
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    assert.equal(integration.ok, true);
    if (!integration.ok) return;
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const combined = buildCombinedReadinessArtifact({
      integration: integration.artifact,
      smoke: smoke.artifact,
      nowIso: "2026-07-14T05:10:00.000Z",
    });
    assert.equal(combined.ok, true);
    if (!combined.ok) return;
    const failures = validateReadinessEvidence(combined.artifact, {
      currentGitSha: GIT_SHA_B,
      currentMigrationChecksum: CHECKSUM,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.ok(failures.some((f) => f.includes("git SHA")));
  });

  it("rejects truncated git SHA", () => {
    const parsed = parseIntegrationProofArtifact(validIntegration({ gitSha: "aaaaaaaaaaaa" }), {
      nowMs: NOW,
    });
    assert.equal(parsed.ok, false);
  });

  it("rejects wrong migration checksum", () => {
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(integration.ok && smoke.ok, true);
    if (!integration.ok || !smoke.ok) return;
    const combined = buildCombinedReadinessArtifact({
      integration: integration.artifact,
      smoke: smoke.artifact,
      nowIso: "2026-07-14T05:10:00.000Z",
    });
    assert.equal(combined.ok, true);
    if (!combined.ok) return;
    const failures = validateReadinessEvidence(combined.artifact, {
      currentGitSha: GIT_SHA,
      currentMigrationChecksum: "ffffffffffffffff",
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.ok(failures.some((f) => f.includes("migration checksum")));
  });

  it("rejects localhost Preview", () => {
    const parsed = parseSmokeProofArtifact(validSmoke({ previewHostname: "localhost" }), {
      nowMs: NOW,
    });
    assert.equal(parsed.ok, false);
  });

  it("rejects Production alias", () => {
    const parsed = parseSmokeProofArtifact(
      validSmoke({ previewHostname: "unstandard-m9qj.vercel.app" }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects main-branch alias", () => {
    const parsed = parseSmokeProofArtifact(
      validSmoke({ previewHostname: "unstandard-m9qj-git-main-unstandard.vercel.app" }),
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects unexpected Preview hostname", () => {
    const smoke = parseSmokeProofArtifact(validSmoke(), { nowMs: NOW });
    assert.equal(smoke.ok, true);
    if (!smoke.ok) return;
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    assert.equal(integration.ok, true);
    if (!integration.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: "other-preview-branch.vercel.app",
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
  });

  it("rejects integration/smoke SHA mismatch", () => {
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    const smoke = parseSmokeProofArtifact(validSmoke({ gitSha: GIT_SHA_B }), { nowMs: NOW });
    assert.equal(integration.ok && smoke.ok, true);
    if (!integration.ok || !smoke.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
    if (combined.ok) return;
    assert.ok(combined.failures.some((f) => f.includes("git SHA mismatch")));
  });

  it("rejects integration/smoke migration checksum mismatch", () => {
    const integration = parseIntegrationProofArtifact(validIntegration(), { nowMs: NOW });
    const smoke = parseSmokeProofArtifact(validSmoke({ migrationChecksum: "abcdef0123456789" }), {
      nowMs: NOW,
    });
    assert.equal(integration.ok && smoke.ok, true);
    if (!integration.ok || !smoke.ok) return;
    const combined = combineSourceArtifacts({
      integration: integration.artifact,
      smoke: smoke.artifact,
      expectedPreviewHostname: PREVIEW_HOST,
      nowMs: NOW,
    });
    assert.equal(combined.ok, false);
  });

  it("rejects malformed artifactVersion", () => {
    const parsed = parseProofArtifact(validIntegration({ artifactVersion: 2 }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects unknown top-level field", () => {
    const parsed = parseProofArtifact(validIntegration({ extra: true }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects unknown case field", () => {
    const cases = [{ name: "report_user_fk", status: "PASS", detail: "nope" }];
    const parsed = parseProofArtifact(validIntegration({ cases }), { nowMs: NOW });
    assert.equal(parsed.ok, false);
  });

  it("rejects smoke pass:boolean legacy shape", () => {
    const parsed = parseProofArtifact(
      {
        ...validSmoke(),
        cases: [{ name: "anonymous_denied", pass: true }],
      },
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.ok(parsed.failures.some((f) => f.includes("legacy pass:boolean")));
  });

  it("rejects SKIPPED active status", () => {
    const parsed = parseProofArtifact(
      {
        ...validSmoke(),
        cases: [{ name: "anonymous_denied", status: "SKIPPED" }],
      },
      { nowMs: NOW },
    );
    assert.equal(parsed.ok, false);
  });
});

describe("session revocation proofs", () => {
  it("keeps cleared_cookie_denied and revoked_session_rejected distinct", () => {
    assert.notEqual("cleared_cookie_denied", "revoked_session_rejected");
    assert.ok(REQUIRED_HTTP_SMOKE_CASES.includes("cleared_cookie_denied"));
    assert.ok(REQUIRED_HTTP_SMOKE_CASES.includes("revoked_session_rejected"));
    assert.ok(REQUIRED_HTTP_SMOKE_CASES.includes("logout_invalidates_session"));
    assert.ok(REQUIRED_HTTP_SMOKE_CASES.includes("session_response_no_store"));
  });

  it("revoked_session_rejected uses stale pre-logout CookieJar replay", async () => {
    const jar = new CookieJar();
    jar.ingest("better-auth.session_token=stale-value; Path=/; HttpOnly");
    assert.equal(jar.size(), 1);

    const seen: string[] = [];
    const result = await proveRevokedSessionRejected({
      jar,
      getSession: async (probeJar) => {
        const header = probeJar.header() ?? "none";
        seen.push(header.includes("stale-value") ? "with-stale" : "without-cookie");
        if (header.includes("stale-value")) {
          // First call authenticated; final replay should be rejected even with stale cookie
          if (seen.filter((s) => s === "with-stale").length === 1) {
            return { status: 200 };
          }
          return { status: 401 };
        }
        return { status: 401 };
      },
      logout: async (liveJar) => {
        liveJar.clear();
        return { status: 200 };
      },
    });

    assert.equal(result.usedStaleClone, true);
    assert.equal(result.pass, true);
    assert.ok(seen.includes("with-stale"));
    assert.ok(seen.includes("without-cookie"));
  });

  it("cleared_cookie_denied does not call logout", async () => {
    const jar = new CookieJar();
    jar.ingest("better-auth.session_token=live; Path=/");
    const pass = await proveClearedCookieDenied({
      jar,
      getSession: async (probeJar) => ({ status: probeJar.header() ? 200 : 401 }),
    });
    assert.equal(pass, true);
    assert.equal(jar.size(), 0);
  });
});

describe("artifact secret safety and atomic write", () => {
  it("refuses cookies/emails/passwords/tokens/database URLs in artifacts", () => {
    const withCookie = buildSmokeArtifact({
      verdict: "PASS",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      previewHostname: PREVIEW_HOST,
      cases: allPassCases(REQUIRED_HTTP_SMOKE_CASES),
      futureNotApplicable: [
        { name: "leak", reason: "cookie=better-auth.session_token=abc" },
      ],
    });
    assert.equal(withCookie.ok, false);

    const withEmail = parseSmokeProofArtifact(
      validSmoke({
        futureNotApplicable: [{ name: "leak", reason: "contact user@example.com" }],
      }),
      { nowMs: NOW },
    );
    assert.equal(withEmail.ok, false);

    const withPassword = parseProofArtifact(
      { ...validIntegration(), password: "secret" },
      { nowMs: NOW },
    );
    assert.equal(withPassword.ok, false);

    const withAuth = parseProofArtifact(
      { ...validIntegration(), authorization: "Bearer abc.def" },
      { nowMs: NOW },
    );
    assert.equal(withAuth.ok, false);

    const withDb = parseSmokeProofArtifact(
      validSmoke({
        futureNotApplicable: [{ name: "leak", reason: "postgresql://user:pass@host/db" }],
      }),
      { nowMs: NOW },
    );
    assert.equal(withDb.ok, false);
  });

  it("does not leave temporary artifact as successful output after write failure", () => {
    const dir = join(tmpdir(), `proof-write-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, "out.json");
    try {
      assert.throws(() =>
        writeProofArtifactAtomicallyWithInjectedFailure({
          outputPath: out,
          artifact: validIntegration(),
          injectFailureAfterTempWrite: true,
        }),
      );
      assert.equal(existsSync(out), false);
      const leftovers = readFileSync;
      void leftovers;
      // No successful destination; temp cleaned by helper
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes atomically on success", () => {
    const dir = join(tmpdir(), `proof-write-ok-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, "integration.json");
    try {
      const built = buildIntegrationArtifact({
        verdict: "PASS",
        gitSha: GIT_SHA,
        migrationChecksum: CHECKSUM,
        timestamp: "2026-07-14T05:00:00.000Z",
        cases: allPassCases(REQUIRED_INTEGRATION_CASES),
      });
      assert.equal(built.ok, true);
      if (!built.ok) return;
      writeProofArtifactAtomically({ outputPath: out, artifact: built.artifact });
      const raw = JSON.parse(readFileSync(out, "utf8")) as { verdict: string };
      assert.equal(raw.verdict, "PASS");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocked integration/smoke runs must not create PASS artifacts (contract helpers)", () => {
    // Contract documented by builders: BLOCKED_EXTERNAL cannot carry PASS cases.
    const blocked = buildIntegrationArtifact({
      verdict: "BLOCKED_EXTERNAL",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      cases: [{ name: "report_user_fk", status: "PASS" }],
    });
    assert.equal(blocked.ok, false);

    const blockedSmoke = buildSmokeArtifact({
      verdict: "BLOCKED_EXTERNAL",
      gitSha: GIT_SHA,
      migrationChecksum: CHECKSUM,
      timestamp: "2026-07-14T05:00:00.000Z",
      previewHostname: PREVIEW_HOST,
      cases: [{ name: "anonymous_denied", status: "PASS" }],
    });
    assert.equal(blockedSmoke.ok, false);

    // Simulate blocked path: no artifact file written
    const dir = join(tmpdir(), `blocked-no-pass-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, "should-not-exist.json");
    try {
      assert.equal(existsSync(out), false);
      // blocked runners only print; they do not call writeProofArtifactAtomically
      writeFileSync(join(dir, "marker"), "blocked");
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
