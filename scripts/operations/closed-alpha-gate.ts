import { readFileSync, writeFileSync } from "node:fs";
import {
  buildClosedAlphaLaunchArtifact,
  evaluateClosedAlphaLaunch,
  type ClosedAlphaOperationalAttestation,
} from "../../lib/operations/closed-alpha-gate";
import type { VerifiedProductionReadinessEvidence } from "../../lib/operations/production-evidence";

function required(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(): void {
  const productionPath = required("UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_PATH");
  const attestationPath = required("UNSTANDARD_CLOSED_ALPHA_ATTESTATION_PATH");
  const outputPath = required("UNSTANDARD_CLOSED_ALPHA_GATE_OUT");

  if (!productionPath || !attestationPath || !outputPath) {
    console.error(
      "BLOCKED_EXTERNAL: Production evidence, operational attestation, and gate output paths are required",
    );
    process.exitCode = 2;
    return;
  }

  let production: VerifiedProductionReadinessEvidence;
  let attestation: ClosedAlphaOperationalAttestation;
  try {
    production = readJson(productionPath) as VerifiedProductionReadinessEvidence;
    attestation = readJson(attestationPath) as ClosedAlphaOperationalAttestation;
  } catch {
    console.error("FAIL: an operational input is missing or invalid JSON");
    process.exitCode = 1;
    return;
  }

  const evaluation = evaluateClosedAlphaLaunch({ production, attestation });
  for (const item of evaluation.gates) {
    console.info(`${item.status} ${item.name}: ${item.code}`);
  }
  if (!evaluation.ok) {
    console.error("NOT_READY: closed-alpha operational gate is incomplete");
    process.exitCode = 1;
    return;
  }

  const artifact = buildClosedAlphaLaunchArtifact({ production, attestation });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  console.info(`PASS: closed-alpha launch gate ${artifact.contentDigest}`);
}

try {
  main();
} catch {
  console.error("FAIL: closed-alpha launch gate failed unexpectedly");
  process.exitCode = 1;
}
