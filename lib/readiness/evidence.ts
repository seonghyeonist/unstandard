import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export type ReadinessEvidence = {
  gitSha: string;
  previewHostname: string;
  migrationChecksum: string;
  timestamp: string;
  integration: {
    verdict: "PASS" | "FAIL" | "BLOCKED_EXTERNAL";
    cases: Array<{ name: string; status: "PASS" | "FAIL" }>;
  };
  smoke: {
    verdict: "PASS" | "FAIL" | "INCOMPLETE" | "BLOCKED_EXTERNAL";
    cases: Array<{ name: string; status: "PASS" | "FAIL" | "SKIPPED" }>;
  };
};

const REQUIRED_SMOKE_CASES = [
  "anonymous_denied",
  "user_a_login",
  "user_b_login",
  "user_a_session",
  "user_b_session",
  "user_a_owns_session",
  "user_b_owns_session",
  "forged_reporter_id_rejected",
  "self_report_rejected",
  "session_response_redacted",
  "logout_invalidates_session",
  "revoked_session_rejected",
];

export function loadReadinessEvidence(path: string): ReadinessEvidence {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ReadinessEvidence;
}

export function validateReadinessEvidence(
  evidence: ReadinessEvidence,
  options: {
    currentGitSha: string;
    currentMigrationChecksum: string;
    maxAgeMinutes?: number;
  },
): string[] {
  const failures: string[] = [];
  const maxAgeMinutes = options.maxAgeMinutes ?? 24 * 60;

  if (evidence.gitSha !== options.currentGitSha) {
    failures.push("evidence git SHA does not match current HEAD");
  }

  if (evidence.migrationChecksum !== options.currentMigrationChecksum) {
    failures.push("evidence migration checksum does not match repository");
  }

  if (!evidence.previewHostname || evidence.previewHostname.includes("localhost")) {
    failures.push("evidence preview hostname is missing or invalid");
  }

  const ageMs = Date.now() - Date.parse(evidence.timestamp);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMinutes * 60 * 1000) {
    failures.push("evidence timestamp is stale or invalid");
  }

  if (evidence.integration.verdict !== "PASS") {
    failures.push("integration evidence is not PASS");
  }

  if (evidence.smoke.verdict !== "PASS") {
    failures.push("smoke evidence is not PASS");
  }

  const smokeNames = new Set(evidence.smoke.cases.map((item) => item.name));
  for (const required of REQUIRED_SMOKE_CASES) {
    if (!smokeNames.has(required)) {
      failures.push(`smoke evidence missing required case: ${required}`);
    }
  }

  return failures;
}

export function sanitizeEvidenceForOutput(evidence: ReadinessEvidence): Record<string, unknown> {
  const hash = createHash("sha256").update(JSON.stringify(evidence)).digest("hex").slice(0, 16);
  return {
    evidenceHash: hash,
    gitSha: evidence.gitSha.slice(0, 12),
    previewHostname: evidence.previewHostname,
    migrationChecksum: evidence.migrationChecksum,
    timestamp: evidence.timestamp,
    integrationVerdict: evidence.integration.verdict,
    smokeVerdict: evidence.smoke.verdict,
    requiredSmokeCases: evidence.smoke.cases.map((item) => item.name),
  };
}

export function getCurrentGitSha(): string {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}
