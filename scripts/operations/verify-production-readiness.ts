import { writeFileSync } from "node:fs";
import {
  buildVerifiedProductionEvidence,
  verifyProductionReadinessReport,
} from "../../lib/operations/production-evidence";

function required(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

async function main(): Promise<void> {
  const baseUrl = required("UNSTANDARD_PRODUCTION_BASE_URL");
  const token = required("UNSTANDARD_DEBUG_CHECK_TOKEN");
  const expectedGitSha = required("UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA");
  const outputPath = required("UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_OUT");
  const expectedDatabaseHostSha12 = required("UNSTANDARD_EXPECTED_PRODUCTION_DB_HOST_SHA12");

  if (!baseUrl || !token || !expectedGitSha || !outputPath) {
    console.error(
      "BLOCKED_EXTERNAL: production base URL, operator token, expected git SHA, and evidence output path are required",
    );
    process.exitCode = 2;
    return;
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    console.error("FAIL: UNSTANDARD_PRODUCTION_BASE_URL is not a valid URL");
    process.exitCode = 1;
    return;
  }
  if (parsedBaseUrl.protocol !== "https:" || parsedBaseUrl.pathname !== "/") {
    console.error("FAIL: Production base URL must be an HTTPS origin without a path");
    process.exitCode = 1;
    return;
  }

  const response = await fetch(new URL("/api/operations/readiness", parsedBaseUrl), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    console.error(`FAIL: readiness endpoint returned non-JSON HTTP ${response.status}`);
    process.exitCode = 1;
    return;
  }

  const verification = verifyProductionReadinessReport({
    value,
    expectedGitSha,
    expectedHostname: parsedBaseUrl.host,
    expectedDatabaseHostSha12: expectedDatabaseHostSha12 ?? undefined,
  });
  if (!response.ok || !verification.ok || !verification.report) {
    console.error(`FAIL: production readiness HTTP ${response.status}`);
    for (const failure of verification.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const evidence = buildVerifiedProductionEvidence({
    report: verification.report,
    hostname: parsedBaseUrl.host,
  });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  console.info("PASS: verified Production runtime and read-only Neon readiness");
  console.info(`gitSha=${evidence.gitSha}`);
  console.info(`databaseHostSha12=${evidence.databaseHostSha12}`);
  console.info(`contentDigest=${evidence.contentDigest}`);
}

main().catch(() => {
  console.error("FAIL: production readiness verification failed unexpectedly");
  process.exitCode = 1;
});
