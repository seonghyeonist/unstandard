import { createHash } from "node:crypto";
import {
  PRODUCTION_READINESS_PASS_CODES,
  type ProductionReadinessReport,
} from "@/lib/operations/production-readiness";

export const PRODUCTION_READINESS_MAX_AGE_MS = 15 * 60 * 1000;

export type ProductionEvidenceVerification = {
  ok: boolean;
  failures: string[];
  report: ProductionReadinessReport | null;
};

export type VerifiedProductionReadinessEvidence = {
  artifactVersion: 1;
  kind: "verified_production_readiness";
  verifiedAt: string;
  sourceGeneratedAt: string;
  gitSha: string;
  hostname: string;
  databaseHostSha12: string;
  gateCodes: string[];
  contentDigest: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function verifyProductionReadinessReport(input: {
  value: unknown;
  expectedGitSha: string;
  expectedHostname: string;
  expectedDatabaseHostSha12?: string;
  nowMs?: number;
}): ProductionEvidenceVerification {
  const failures: string[] = [];
  const root = asRecord(input.value);
  const release = asRecord(root?.release);
  const database = asRecord(root?.database);
  const gates = Array.isArray(root?.gates) ? root?.gates : [];

  if (root?.artifactVersion !== 1 || root?.kind !== "production_readiness") {
    failures.push("invalid production readiness artifact identity");
  }
  if (root?.ok !== true) {
    failures.push("production readiness report is not PASS");
  }
  if (release?.gitSha !== input.expectedGitSha) {
    failures.push("deployed git SHA does not match expected SHA");
  }
  if (release?.vercelEnv !== "production") {
    failures.push("report is not from Vercel Production");
  }
  if (release?.requestHost !== input.expectedHostname) {
    failures.push("report hostname does not match the canonical Production hostname");
  }
  if (
    input.expectedDatabaseHostSha12 &&
    database?.hostSha12 !== input.expectedDatabaseHostSha12
  ) {
    failures.push("database hostname fingerprint does not match the approved target");
  }
  if (typeof database?.hostSha12 !== "string" || !/^[a-f0-9]{12}$/u.test(database.hostSha12)) {
    failures.push("database hostname fingerprint is missing or invalid");
  }

  const generatedAt = typeof root?.generatedAt === "string" ? Date.parse(root.generatedAt) : NaN;
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(generatedAt) || generatedAt > nowMs + 60_000) {
    failures.push("production readiness timestamp is invalid or in the future");
  } else if (nowMs - generatedAt > PRODUCTION_READINESS_MAX_AGE_MS) {
    failures.push("production readiness report is stale");
  }

  const parsedGates = gates.map(asRecord);
  if (parsedGates.length === 0 || parsedGates.some((item) => item?.status !== "PASS")) {
    failures.push("one or more production readiness gates did not PASS");
  }
  const gateCodes = parsedGates.map((item) => item?.code);
  if (
    gateCodes.length !== PRODUCTION_READINESS_PASS_CODES.length ||
    gateCodes.some((code, index) => code !== PRODUCTION_READINESS_PASS_CODES[index])
  ) {
    failures.push("production readiness gate contract is incomplete or reordered");
  }

  return {
    ok: failures.length === 0,
    failures,
    report: failures.length === 0 ? (input.value as ProductionReadinessReport) : null,
  };
}

export function buildVerifiedProductionEvidence(input: {
  report: ProductionReadinessReport;
  hostname: string;
  verifiedAt?: string;
}): VerifiedProductionReadinessEvidence {
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  const base = {
    artifactVersion: 1 as const,
    kind: "verified_production_readiness" as const,
    verifiedAt,
    sourceGeneratedAt: input.report.generatedAt,
    gitSha: input.report.release.gitSha as string,
    hostname: input.hostname,
    databaseHostSha12: input.report.database.hostSha12 as string,
    gateCodes: input.report.gates.map((item) => item.code),
  };
  const contentDigest = createHash("sha256")
    .update(JSON.stringify(base))
    .digest("hex");
  return { ...base, contentDigest };
}
