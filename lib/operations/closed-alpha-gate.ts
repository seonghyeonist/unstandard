import { createHash } from "node:crypto";
import type { VerifiedProductionReadinessEvidence } from "@/lib/operations/production-evidence";

export const CLOSED_ALPHA_TECHNICAL_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const CLOSED_ALPHA_ATTESTATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const REQUIRED_OPERATIONAL_ATTESTATIONS = [
  "incidentOwnerAssigned",
  "supportChannelReady",
  "rollbackProcedureReviewed",
  "restoreDrillCompleted",
  "privacyNoticePublished",
  "accountDeletionProcedureVerified",
  "moderationOwnerAssigned",
  "rateLimitPolicyApproved",
  "productionDatabaseBranchProtected",
] as const;

export type OperationalAttestationKey = (typeof REQUIRED_OPERATIONAL_ATTESTATIONS)[number];

export type ClosedAlphaOperationalAttestation = {
  artifactVersion: 2;
  kind: "closed_alpha_operational_attestation";
  subjectGitSha: string;
  reviewedAt: string;
  initialCohortCap: number;
  incidentResponseMinutes: number;
  attestations: Record<OperationalAttestationKey, boolean>;
  evidence: {
    incidentOwner: string;
    supportOwner: string;
    moderationOwner: string;
    privacyOwner: string;
    supportChannel: "in_app_support_requests";
    supportTestReference: string;
    rollbackDeploymentId: string;
    productionDatabase: {
      projectId: string;
      branchId: string;
      branchName: string;
      protected: boolean;
    };
    restoreDrill: {
      branchId: string;
      completedAt: string;
      result: "PASS";
    };
    privacyNoticeUrl: string;
    accountDeletionTestReference: string;
    rateLimitPolicyVersion: "closed-alpha-v1";
  };
  notes?: string[];
};

export type ClosedAlphaLaunchGate = {
  name: string;
  status: "PASS" | "FAIL";
  code: string;
};

export type ClosedAlphaLaunchArtifact = {
  artifactVersion: 2;
  kind: "closed_alpha_launch_gate";
  ok: true;
  generatedAt: string;
  gitSha: string;
  productionEvidenceDigest: string;
  operationalReviewAt: string;
  operationalEvidenceDigest: string;
  initialCohortCap: number;
  incidentResponseMinutes: number;
  gates: ClosedAlphaLaunchGate[];
  contentDigest: string;
};

function gate(name: string, passed: boolean, passCode: string, failCode: string) {
  return {
    name,
    status: passed ? ("PASS" as const) : ("FAIL" as const),
    code: passed ? passCode : failCode,
  };
}

function isSubstantive(value: string): boolean {
  return Boolean(
    value.trim().length >= 3 && !/(?:todo|tbd|replace|placeholder|unknown)/iu.test(value),
  );
}

function isHttpsPrivacyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/privacy";
  } catch {
    return false;
  }
}

function operationalEvidenceIsComplete(
  attestation: ClosedAlphaOperationalAttestation,
  nowMs: number,
): boolean {
  const evidence = attestation.evidence;
  if (!evidence) return false;
  return (
    [
      evidence.incidentOwner,
      evidence.supportOwner,
      evidence.moderationOwner,
      evidence.privacyOwner,
      evidence.supportTestReference,
      evidence.accountDeletionTestReference,
    ].every(isSubstantive) &&
    evidence.supportChannel === "in_app_support_requests" &&
    /^dpl_[A-Za-z0-9]+$/u.test(evidence.rollbackDeploymentId) &&
    isSubstantive(evidence.productionDatabase.projectId) &&
    /^br-[a-z0-9-]+$/u.test(evidence.productionDatabase.branchId) &&
    isSubstantive(evidence.productionDatabase.branchName) &&
    evidence.productionDatabase.protected === true &&
    /^br-[a-z0-9-]+$/u.test(evidence.restoreDrill.branchId) &&
    evidence.restoreDrill.result === "PASS" &&
    timestampIsFresh(evidence.restoreDrill.completedAt, CLOSED_ALPHA_ATTESTATION_MAX_AGE_MS, nowMs) &&
    isHttpsPrivacyUrl(evidence.privacyNoticeUrl) &&
    evidence.rateLimitPolicyVersion === "closed-alpha-v1"
  );
}

function timestampIsFresh(value: string, maxAgeMs: number, nowMs: number): boolean {
  const parsed = Date.parse(value);
  return (
    Number.isFinite(parsed) &&
    parsed <= nowMs + 60_000 &&
    nowMs - parsed <= maxAgeMs
  );
}

function productionEvidenceDigestIsValid(
  production: VerifiedProductionReadinessEvidence,
): boolean {
  if (
    production.artifactVersion !== 1 ||
    production.kind !== "verified_production_readiness" ||
    typeof production.contentDigest !== "string"
  ) {
    return false;
  }
  const { contentDigest, ...base } = production;
  const expected = createHash("sha256").update(JSON.stringify(base)).digest("hex");
  return expected === contentDigest;
}

export function evaluateClosedAlphaLaunch(input: {
  production: VerifiedProductionReadinessEvidence;
  attestation: ClosedAlphaOperationalAttestation;
  nowMs?: number;
}): { ok: boolean; gates: ClosedAlphaLaunchGate[] } {
  const nowMs = input.nowMs ?? Date.now();
  const attestationsComplete = REQUIRED_OPERATIONAL_ATTESTATIONS.every(
    (key) => input.attestation.attestations?.[key] === true,
  );

  const gates = [
    gate(
      "technical_evidence_integrity",
      productionEvidenceDigestIsValid(input.production),
      "TECHNICAL_EVIDENCE_INTEGRITY_PASS",
      "TECHNICAL_EVIDENCE_INTEGRITY_FAIL",
    ),
    gate(
      "attestation_identity",
      input.attestation.artifactVersion === 2 &&
        input.attestation.kind === "closed_alpha_operational_attestation",
      "ATTESTATION_IDENTITY_PASS",
      "ATTESTATION_IDENTITY_FAIL",
    ),
    gate(
      "subject_identity",
      input.production.gitSha === input.attestation.subjectGitSha,
      "SUBJECT_SHA_MATCH",
      "SUBJECT_SHA_MISMATCH",
    ),
    gate(
      "technical_freshness",
      timestampIsFresh(
        input.production.verifiedAt,
        CLOSED_ALPHA_TECHNICAL_MAX_AGE_MS,
        nowMs,
      ),
      "TECHNICAL_EVIDENCE_FRESH",
      "TECHNICAL_EVIDENCE_STALE",
    ),
    gate(
      "operational_review_freshness",
      timestampIsFresh(
        input.attestation.reviewedAt,
        CLOSED_ALPHA_ATTESTATION_MAX_AGE_MS,
        nowMs,
      ),
      "OPERATIONAL_REVIEW_FRESH",
      "OPERATIONAL_REVIEW_STALE",
    ),
    gate(
      "operational_attestations",
      attestationsComplete,
      "OPERATIONAL_ATTESTATIONS_COMPLETE",
      "OPERATIONAL_ATTESTATION_MISSING",
    ),
    gate(
      "operational_evidence",
      operationalEvidenceIsComplete(input.attestation, nowMs),
      "OPERATIONAL_EVIDENCE_COMPLETE",
      "OPERATIONAL_EVIDENCE_MISSING_OR_PLACEHOLDER",
    ),
    gate(
      "cohort_cap",
      Number.isInteger(input.attestation.initialCohortCap) &&
        input.attestation.initialCohortCap >= 1 &&
        input.attestation.initialCohortCap <= 100,
      "COHORT_CAP_APPROVED",
      "COHORT_CAP_INVALID",
    ),
    gate(
      "incident_response_target",
      Number.isInteger(input.attestation.incidentResponseMinutes) &&
        input.attestation.incidentResponseMinutes >= 1 &&
        input.attestation.incidentResponseMinutes <= 1_440,
      "INCIDENT_RESPONSE_TARGET_APPROVED",
      "INCIDENT_RESPONSE_TARGET_INVALID",
    ),
  ];

  return { ok: gates.every((item) => item.status === "PASS"), gates };
}

export function buildClosedAlphaLaunchArtifact(input: {
  production: VerifiedProductionReadinessEvidence;
  attestation: ClosedAlphaOperationalAttestation;
  generatedAt?: string;
}): ClosedAlphaLaunchArtifact {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const evaluation = evaluateClosedAlphaLaunch({
    production: input.production,
    attestation: input.attestation,
    nowMs: Date.parse(generatedAt),
  });
  if (!evaluation.ok) {
    throw new Error("closed-alpha launch gate is not satisfied");
  }

  const base = {
    artifactVersion: 2 as const,
    kind: "closed_alpha_launch_gate" as const,
    ok: true as const,
    generatedAt,
    gitSha: input.production.gitSha,
    productionEvidenceDigest: input.production.contentDigest,
    operationalReviewAt: input.attestation.reviewedAt,
    operationalEvidenceDigest: createHash("sha256")
      .update(JSON.stringify(input.attestation.evidence))
      .digest("hex"),
    initialCohortCap: input.attestation.initialCohortCap,
    incidentResponseMinutes: input.attestation.incidentResponseMinutes,
    gates: evaluation.gates,
  };
  const contentDigest = createHash("sha256").update(JSON.stringify(base)).digest("hex");
  return { ...base, contentDigest };
}
