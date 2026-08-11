/**
 * Build combined readiness evidence from machine-generated integration + smoke artifacts.
 *
 * No manually edited PASS JSON. contentDigest is not a signature.
 */

import { extractHostname, hostnameFailureMessage, validateEvidenceHostname } from "../../lib/readiness/hostnames";
import {
  combineSourceArtifacts,
  loadSourceArtifactFromPath,
} from "../../lib/readiness/evidence";
import { writeProofArtifactAtomically } from "../../lib/readiness/proof-artifact";
import type { IntegrationProofArtifact, SmokeProofArtifact } from "../../lib/readiness/proof-artifact";

function blocked(message: string): never {
  console.error(`BLOCKED_EXTERNAL: ${message}`);
  process.exit(2);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const integrationPath = process.env.UNSTANDARD_INTEGRATION_EVIDENCE_PATH?.trim();
  const smokePath = process.env.UNSTANDARD_SMOKE_EVIDENCE_PATH?.trim();
  const outPath = process.env.UNSTANDARD_READINESS_EVIDENCE_OUT?.trim();
  const expectedHostRaw = process.env.UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME?.trim();

  if (!integrationPath || !smokePath || !outPath || !expectedHostRaw) {
    blocked(
      "UNSTANDARD_INTEGRATION_EVIDENCE_PATH, UNSTANDARD_SMOKE_EVIDENCE_PATH, UNSTANDARD_READINESS_EVIDENCE_OUT, and UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME are required",
    );
  }

  const expectedHostname = extractHostname(expectedHostRaw) ?? expectedHostRaw.toLowerCase();
  const hostFailure = validateEvidenceHostname(expectedHostname);
  if (hostFailure) {
    fail(hostnameFailureMessage(hostFailure));
  }

  let integration: IntegrationProofArtifact;
  let smoke: SmokeProofArtifact;
  try {
    integration = loadSourceArtifactFromPath(integrationPath, "integration") as IntegrationProofArtifact;
    smoke = loadSourceArtifactFromPath(smokePath, "smoke") as SmokeProofArtifact;
  } catch (error) {
    fail(error instanceof Error ? error.message : "unable to load source artifacts");
  }

  const combined = combineSourceArtifacts({
    integration,
    smoke,
    expectedPreviewHostname: expectedHostname,
  });

  if (!combined.ok) {
    fail(combined.failures.join("; "));
  }

  writeProofArtifactAtomically({
    outputPath: outPath,
    artifact: combined.artifact,
    allowOverwriteDifferentSha: process.env.UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA === "yes",
  });

  console.log(
    JSON.stringify(
      {
        verdict: "PASS",
        kind: "readiness",
        previewHostname: combined.artifact.previewHostname,
        contentDigest: combined.artifact.contentDigest,
        contentDigestNote:
          "contentDigest identifies serialized content only; it is not a signature, not tamper-proof, and not an independent attestation",
        vercelDeploymentNote:
          "Operator must separately verify Vercel Preview deployment metadata maps to this gitSha",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "readiness evidence build failed");
});
