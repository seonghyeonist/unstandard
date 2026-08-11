import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { REQUIRED_APPLICATION_TABLES } from "../lib/db/migration-contract.ts";
import {
  EXPECTED_MIGRATION_HASHES,
  EXPECTED_MIGRATION_LEDGER,
} from "../lib/db/migration-manifest.ts";
import {
  buildProductionReadinessReport,
  type ProductionDatabaseObservation,
  type ProductionEnvironmentSnapshot,
} from "../lib/operations/production-readiness.ts";
import {
  buildVerifiedProductionEvidence,
  verifyProductionReadinessReport,
} from "../lib/operations/production-evidence.ts";
import {
  buildClosedAlphaLaunchArtifact,
  evaluateClosedAlphaLaunch,
  type ClosedAlphaOperationalAttestation,
} from "../lib/operations/closed-alpha-gate.ts";

const NOW = "2026-08-11T08:00:00.000Z";
const SHA = "a".repeat(40);

function environment(
  overrides: Partial<ProductionEnvironmentSnapshot> = {},
): ProductionEnvironmentSnapshot {
  return {
    nodeEnv: "production",
    vercelEnv: "production",
    runtimeMode: "database",
    databaseEnv: "production",
    releaseSha: SHA,
    hasDatabaseUrl: true,
    hasBetterAuthSecret: true,
    hasBetterAuthUrl: true,
    hasAuthCookieSecret: true,
    hasUnstandardAppUrl: true,
    betterAuthUrl: "https://alpha.example.com",
    unstandardAppUrl: "https://alpha.example.com",
    ...overrides,
  };
}

function database(
  overrides: Partial<ProductionDatabaseObservation> = {},
): ProductionDatabaseObservation {
  return {
    hostSha12: "aabbccddeeff",
    currentDatabase: "neondb",
    migrationHashes: [...EXPECTED_MIGRATION_HASHES],
    presentTables: [...REQUIRED_APPLICATION_TABLES],
    alphaClosedEnabled: true,
    unlockQuestionId: "33333333-3333-4333-8333-333333333333",
    unlockQuestionActive: true,
    ...overrides,
  };
}

function attestation(
  overrides: Partial<ClosedAlphaOperationalAttestation> = {},
): ClosedAlphaOperationalAttestation {
  return {
    artifactVersion: 2,
    kind: "closed_alpha_operational_attestation",
    subjectGitSha: SHA,
    reviewedAt: NOW,
    initialCohortCap: 20,
    incidentResponseMinutes: 240,
    attestations: {
      incidentOwnerAssigned: true,
      supportChannelReady: true,
      rollbackProcedureReviewed: true,
      restoreDrillCompleted: true,
      privacyNoticePublished: true,
      accountDeletionProcedureVerified: true,
      moderationOwnerAssigned: true,
      rateLimitPolicyApproved: true,
      productionDatabaseBranchProtected: true,
    },
    evidence: {
      incidentOwner: "founder-seonghyeonist",
      supportOwner: "founder-seonghyeonist",
      moderationOwner: "founder-seonghyeonist",
      privacyOwner: "founder-seonghyeonist",
      supportChannel: "in_app_support_requests",
      supportTestReference: "test-ticket-123",
      rollbackDeploymentId: "dpl_abc123",
      productionDatabase: {
        projectId: "raspy-fog-00907976",
        branchId: "br-bitter-wave-ajs8dy0u",
        branchName: "production",
        protected: true,
      },
      restoreDrill: {
        branchId: "br-restore-drill-123",
        completedAt: NOW,
        result: "PASS",
      },
      privacyNoticeUrl: "https://alpha.example.com/privacy",
      accountDeletionTestReference: "delete-integration-123",
      rateLimitPolicyVersion: "closed-alpha-v1",
    },
    ...overrides,
  };
}

describe("Production readiness", () => {
  it("keeps the checked-in migration manifest byte-exact", () => {
    for (const migration of EXPECTED_MIGRATION_LEDGER) {
      const content = readFileSync(join(process.cwd(), "drizzle/migrations", migration.file));
      const digest = createHash("sha256").update(content).digest("hex");
      assert.equal(digest, migration.hash);
    }
  });

  it("passes only the exact Production runtime, schema, and seed contract", () => {
    const report = buildProductionReadinessReport({
      environment: environment(),
      database: database(),
      requestUrl: "https://alpha.example.com/api/operations/readiness",
      generatedAt: NOW,
    });

    assert.equal(report.ok, true);
    assert.equal(report.gates.every((item) => item.status === "PASS"), true);
    assert.equal(JSON.stringify(report).includes("postgresql://"), false);
  });

  it("fails closed for Preview, migration drift, or a missing secret", () => {
    const report = buildProductionReadinessReport({
      environment: environment({
        vercelEnv: "preview",
        hasBetterAuthSecret: false,
      }),
      database: database({ migrationHashes: [EXPECTED_MIGRATION_HASHES[0]] }),
      requestUrl: "https://alpha.example.com/api/operations/readiness",
      generatedAt: NOW,
    });

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.gates.filter((item) => item.status === "FAIL").map((item) => item.name),
      ["production_target", "required_secrets", "migration_ledger"],
    );
  });

  it("binds verified evidence to a fresh exact SHA, hostname, and DB fingerprint", () => {
    const report = buildProductionReadinessReport({
      environment: environment(),
      database: database(),
      requestUrl: "https://alpha.example.com/api/operations/readiness",
      generatedAt: NOW,
    });
    const verified = verifyProductionReadinessReport({
      value: report,
      expectedGitSha: SHA,
      expectedHostname: "alpha.example.com",
      expectedDatabaseHostSha12: "aabbccddeeff",
      nowMs: Date.parse(NOW) + 60_000,
    });
    assert.equal(verified.ok, true);

    const wrongSha = verifyProductionReadinessReport({
      value: report,
      expectedGitSha: "b".repeat(40),
      expectedHostname: "alpha.example.com",
      nowMs: Date.parse(NOW) + 60_000,
    });
    assert.equal(wrongSha.ok, false);
  });
});

describe("Closed-alpha launch separation", () => {
  it("does not pass technical evidence without every operational attestation", () => {
    const report = buildProductionReadinessReport({
      environment: environment(),
      database: database(),
      requestUrl: "https://alpha.example.com/api/operations/readiness",
      generatedAt: NOW,
    });
    const production = buildVerifiedProductionEvidence({
      report,
      hostname: "alpha.example.com",
      verifiedAt: NOW,
    });
    const incomplete = attestation({
      attestations: { ...attestation().attestations, restoreDrillCompleted: false },
    });

    const result = evaluateClosedAlphaLaunch({
      production,
      attestation: incomplete,
      nowMs: Date.parse(NOW) + 60_000,
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.gates.find((item) => item.name === "operational_attestations")?.status,
      "FAIL",
    );
  });

  it("builds a digest-bound artifact only after technical and operational PASS", () => {
    const report = buildProductionReadinessReport({
      environment: environment(),
      database: database(),
      requestUrl: "https://alpha.example.com/api/operations/readiness",
      generatedAt: NOW,
    });
    const production = buildVerifiedProductionEvidence({
      report,
      hostname: "alpha.example.com",
      verifiedAt: NOW,
    });
    const artifact = buildClosedAlphaLaunchArtifact({
      production,
      attestation: attestation(),
      generatedAt: new Date(Date.parse(NOW) + 60_000).toISOString(),
    });

    assert.equal(artifact.ok, true);
    assert.match(artifact.contentDigest, /^[a-f0-9]{64}$/u);
    assert.equal(artifact.gitSha, SHA);
  });
});
