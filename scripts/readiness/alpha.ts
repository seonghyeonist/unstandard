import {
  getCurrentGitSha,
  loadReadinessEvidence,
  sanitizeEvidenceForOutput,
  validateReadinessEvidence,
} from "../../lib/readiness/evidence";
import { migrationSetChecksum } from "../../lib/db/migration-guards";
import { extractHostname } from "../../lib/readiness/hostnames";

async function main(): Promise<void> {
  const evidencePath = process.env.UNSTANDARD_READINESS_EVIDENCE_PATH?.trim();
  if (!evidencePath) {
    console.error("readiness:alpha BLOCKED_EXTERNAL — UNSTANDARD_READINESS_EVIDENCE_PATH missing");
    process.exit(2);
  }

  let evidence;
  try {
    evidence = loadReadinessEvidence(evidencePath);
  } catch (error) {
    console.error(
      "readiness:alpha FAIL — unable to read or parse evidence:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  }

  const expectedHostRaw = process.env.UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME?.trim();
  const expectedPreviewHostname = expectedHostRaw
    ? (extractHostname(expectedHostRaw) ?? expectedHostRaw.toLowerCase())
    : evidence.previewHostname;

  const failures = validateReadinessEvidence(evidence, {
    currentGitSha: getCurrentGitSha(),
    currentMigrationChecksum: migrationSetChecksum(),
    expectedPreviewHostname,
  });

  if (failures.length > 0) {
    console.error("readiness:alpha FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        verdict: "PASS",
        evidence: sanitizeEvidenceForOutput(evidence),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("readiness:alpha FAIL —", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
