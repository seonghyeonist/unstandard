import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  buildCombinedReadinessArtifact,
  loadJsonFile,
  parseCombinedReadinessArtifact,
  parseIntegrationProofArtifact,
  parseSmokeProofArtifact,
  type CombinedReadinessArtifact,
  type IntegrationProofArtifact,
  type SmokeProofArtifact,
} from "./proof-artifact";
import {
  FUTURE_NOT_APPLICABLE_PRIVATE_PROFILE,
  PROOF_CLOCK_SKEW_MS,
  PROOF_MAX_AGE_MS,
  REQUIRED_HTTP_SMOKE_CASES,
  REQUIRED_INTEGRATION_CASES,
} from "./proof-constants";
import { hostnameFailureMessage, validateEvidenceHostname } from "./hostnames";

export {
  REQUIRED_HTTP_SMOKE_CASES,
  REQUIRED_INTEGRATION_CASES,
  FUTURE_NOT_APPLICABLE_PRIVATE_PROFILE,
  PROOF_MAX_AGE_MS,
  PROOF_CLOCK_SKEW_MS,
};

/** Combined readiness evidence (machine-built Artifact Version 1). */
export type ReadinessEvidence = CombinedReadinessArtifact;

export function loadReadinessEvidence(path: string): CombinedReadinessArtifact {
  const raw = loadJsonFile(path);
  const parsed = parseCombinedReadinessArtifact(raw);
  if (!parsed.ok) {
    throw new Error(parsed.failures.join("; "));
  }
  return parsed.artifact;
}

function requireExactPassCases(
  cases: Array<{ name: string; status: string }>,
  required: readonly string[],
  label: string,
): string[] {
  const failures: string[] = [];
  const counts = new Map<string, number>();
  for (const item of cases) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }

  for (const name of required) {
    const count = counts.get(name) ?? 0;
    if (count === 0) {
      failures.push(`${label} missing required case: ${name}`);
      continue;
    }
    if (count !== 1) {
      failures.push(`${label} duplicate required case: ${name}`);
    }
    const match = cases.find((item) => item.name === name);
    if (!match || match.status !== "PASS") {
      failures.push(`${label} required case is not PASS: ${name}`);
    }
  }

  for (const [name, count] of counts) {
    if (count > 1) {
      failures.push(`${label} duplicate case name: ${name}`);
    }
  }

  return failures;
}

export function validateReadinessEvidence(
  evidence: CombinedReadinessArtifact,
  options: {
    currentGitSha: string;
    currentMigrationChecksum: string;
    expectedPreviewHostname?: string;
    maxAgeMs?: number;
    clockSkewMs?: number;
    nowMs?: number;
  },
): string[] {
  const failures: string[] = [];
  const parsed = parseCombinedReadinessArtifact(evidence, {
    nowMs: options.nowMs,
    maxAgeMs: options.maxAgeMs ?? PROOF_MAX_AGE_MS,
    clockSkewMs: options.clockSkewMs ?? PROOF_CLOCK_SKEW_MS,
    expectedPreviewHostname: options.expectedPreviewHostname,
  });
  if (!parsed.ok) {
    failures.push(...parsed.failures);
    return failures;
  }

  if (evidence.gitSha !== options.currentGitSha) {
    failures.push("evidence git SHA does not match current HEAD");
  }

  if (!/^[a-f0-9]{40}$/.test(options.currentGitSha)) {
    failures.push("current git SHA is not a full 40-character lowercase hex SHA");
  }

  if (evidence.migrationChecksum !== options.currentMigrationChecksum) {
    failures.push("evidence migration checksum does not match repository");
  }

  const hostFailure = validateEvidenceHostname(evidence.previewHostname, {
    expectedPreviewHostname: options.expectedPreviewHostname,
  });
  if (hostFailure) {
    failures.push(hostnameFailureMessage(hostFailure));
  }

  if (evidence.verdict !== "PASS") {
    failures.push("readiness verdict is not PASS");
  }

  failures.push(
    ...requireExactPassCases(evidence.integrationCases, REQUIRED_INTEGRATION_CASES, "integration"),
  );
  failures.push(...requireExactPassCases(evidence.smokeCases, REQUIRED_HTTP_SMOKE_CASES, "smoke"));

  return failures;
}

/**
 * contentDigest is not a signature / not tamper-proof / not attestation.
 * sanitizeEvidenceForOutput exposes provenance summaries only.
 */
export function sanitizeEvidenceForOutput(evidence: CombinedReadinessArtifact): Record<string, unknown> {
  return {
    contentDigest: evidence.contentDigest,
    contentDigestNote:
      "contentDigest identifies serialized content only; it is not a signature, not tamper-proof, and not an independent attestation",
    gitSha: evidence.gitSha,
    previewHostname: evidence.previewHostname,
    migrationChecksum: evidence.migrationChecksum,
    timestamp: evidence.timestamp,
    sourceTimestamps: evidence.sourceTimestamps,
    integrationCaseCount: evidence.integrationCases.length,
    smokeCaseCount: evidence.smokeCases.length,
    requiredHttpSmokeCases: evidence.smokeCases.map((item) => item.name),
    requiredIntegrationCases: evidence.integrationCases.map((item) => item.name),
  };
}

export function getCurrentGitSha(): string {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

export function combineSourceArtifacts(input: {
  integration: IntegrationProofArtifact;
  smoke: SmokeProofArtifact;
  expectedPreviewHostname: string;
  nowMs?: number;
  maxAgeMs?: number;
  clockSkewMs?: number;
}): { ok: true; artifact: CombinedReadinessArtifact } | { ok: false; failures: string[] } {
  const failures: string[] = [];
  const nowMs = input.nowMs ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? PROOF_MAX_AGE_MS;
  const clockSkewMs = input.clockSkewMs ?? PROOF_CLOCK_SKEW_MS;

  const integrationParsed = parseIntegrationProofArtifact(input.integration, {
    nowMs,
    maxAgeMs,
    clockSkewMs,
  });
  if (!integrationParsed.ok) {
    failures.push(...integrationParsed.failures.map((f) => `integration: ${f}`));
  }

  const smokeParsed = parseSmokeProofArtifact(input.smoke, {
    nowMs,
    maxAgeMs,
    clockSkewMs,
    expectedPreviewHostname: input.expectedPreviewHostname,
  });
  if (!smokeParsed.ok) {
    failures.push(...smokeParsed.failures.map((f) => `smoke: ${f}`));
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const integration = integrationParsed.ok ? integrationParsed.artifact : null;
  const smoke = smokeParsed.ok ? smokeParsed.artifact : null;
  if (!integration || !smoke) {
    return { ok: false, failures: ["unable to parse source artifacts"] };
  }

  if (integration.verdict !== "PASS") {
    failures.push("integration source verdict is not PASS");
  }
  if (smoke.verdict !== "PASS") {
    failures.push("smoke source verdict is not PASS");
  }

  if (integration.gitSha !== smoke.gitSha) {
    failures.push("integration/smoke git SHA mismatch");
  }
  if (integration.migrationChecksum !== smoke.migrationChecksum) {
    failures.push("integration/smoke migration checksum mismatch");
  }

  const expected = input.expectedPreviewHostname.trim().toLowerCase();
  if (smoke.previewHostname !== expected) {
    failures.push("smoke previewHostname does not equal UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME");
  }

  failures.push(
    ...requireExactPassCases(integration.cases, REQUIRED_INTEGRATION_CASES, "integration source"),
  );
  failures.push(...requireExactPassCases(smoke.cases, REQUIRED_HTTP_SMOKE_CASES, "smoke source"));

  for (const future of smoke.futureNotApplicable ?? []) {
    if ((REQUIRED_HTTP_SMOKE_CASES as readonly string[]).includes(future.name)) {
      failures.push(`required smoke case listed as futureNotApplicable: ${future.name}`);
    }
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  return buildCombinedReadinessArtifact(
    { integration, smoke },
    {
      nowMs,
      maxAgeMs,
      clockSkewMs,
      expectedPreviewHostname: input.expectedPreviewHostname,
    },
  );
}

/** @deprecated Prefer contentDigest naming; kept only to avoid silent accidental imports. */
export function legacyEvidenceHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function loadSourceArtifactFromPath(
  path: string,
  kind: "integration" | "smoke",
): IntegrationProofArtifact | SmokeProofArtifact {
  const raw = loadJsonFile(path);
  if (kind === "integration") {
    const parsed = parseIntegrationProofArtifact(raw);
    if (!parsed.ok) {
      throw new Error(parsed.failures.join("; "));
    }
    return parsed.artifact;
  }
  const parsed = parseSmokeProofArtifact(raw);
  if (!parsed.ok) {
    throw new Error(parsed.failures.join("; "));
  }
  return parsed.artifact;
}
