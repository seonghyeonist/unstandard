/**
 * Deployed Preview adversarial authorization smoke (HTTP boundary).
 * Required HTTP Alpha surface only — DB-only proofs belong in test:integration.
 *
 * Artifact gitSha is the local runner checkout provenance only.
 * It does not cryptographically attest the remote Vercel deployment SHA;
 * operators must verify deployment metadata separately.
 */

import { migrationSetChecksum } from "../../lib/db/migration-guards";
import { getCurrentGitSha } from "../../lib/readiness/evidence";
import {
  FUTURE_NOT_APPLICABLE_PRIVATE_PROFILE,
  REQUIRED_HTTP_SMOKE_CASES,
} from "../../lib/readiness/proof-constants";
import {
  buildSmokeArtifact,
  writeProofArtifactAtomically,
  type ProofCase,
} from "../../lib/readiness/proof-artifact";
import { extractHostname, validateEvidenceHostname, hostnameFailureMessage } from "../../lib/readiness/hostnames";
import { CookieJar, collectSetCookieHeaders } from "../../lib/smoke/cookie-jar";
import {
  proveClearedCookieDenied,
  proveLogoutInvalidatesSession,
  proveRevokedSessionRejected,
} from "../../lib/smoke/session-revocation";

const baseUrl = process.env.SMOKE_BASE_URL?.trim();
const userAEmail = process.env.SMOKE_USER_A_EMAIL?.trim();
const userAPassword = process.env.SMOKE_USER_A_PASSWORD;
const userBEmail = process.env.SMOKE_USER_B_EMAIL?.trim();
const userBPassword = process.env.SMOKE_USER_B_PASSWORD;
const previewBypass = process.env.SMOKE_VERCEL_PROTECTION_BYPASS?.trim();
const profileAId = process.env.SMOKE_USER_A_PROFILE_ID?.trim();
const profileBId = process.env.SMOKE_USER_B_PROFILE_ID?.trim();

type FutureCase = {
  name: string;
  reason: string;
};

function redact(value: string): string {
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[id]",
    )
    .replace(/better-auth\.session_token=[^;]+/gi, "[session-cookie]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[authorization]");
}

function blocked(message: string): never {
  console.error(`BLOCKED_EXTERNAL: ${message}`);
  const out = process.env.UNSTANDARD_SMOKE_EVIDENCE_OUT?.trim();
  if (out) {
    console.error("BLOCKED_EXTERNAL: no smoke PASS artifact written");
  }
  process.exit(2);
}

async function fetchJson(
  path: string,
  init: RequestInit = {},
  jar?: CookieJar,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const headers = new Headers(init.headers ?? {});
  if (previewBypass) {
    headers.set("x-vercel-protection-bypass", previewBypass);
  }
  const cookieHeader = jar?.header();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  jar?.ingestAll(collectSetCookieHeaders(response.headers));

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 120) };
  }

  return { status: response.status, body, headers: response.headers };
}

function isPrivateNoStore(headers: Headers): boolean {
  const cacheControl = headers.get("cache-control") ?? "";
  return (
    /\bprivate\b/i.test(cacheControl) &&
    /\bno-store\b/i.test(cacheControl) &&
    !/\bpublic\b/i.test(cacheControl)
  );
}

async function signIn(
  email: string,
  password: string,
  jar: CookieJar,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetchJson(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    jar,
  );

  return { ok: response.status >= 200 && response.status < 300, status: response.status };
}

function sessionHasSensitiveFields(body: unknown): boolean {
  const serialized = JSON.stringify(body ?? {});
  return (
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(serialized) ||
    /"email"\s*:/.test(serialized) ||
    /"token"\s*:/.test(serialized) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(serialized)
  );
}

function pushCase(cases: ProofCase[], name: string, pass: boolean): void {
  cases.push({ name, status: pass ? "PASS" : "FAIL" });
}

async function main(): Promise<void> {
  const cases: ProofCase[] = [];
  const futureNotApplicable: FutureCase[] = [
    { ...FUTURE_NOT_APPLICABLE_PRIVATE_PROFILE },
    {
      name: "private_mock_profile_requires_unlock_cookie",
      reason:
        "Informational mock-contract only: /api/profile/[id]/private uses mock publicProfiles IDs and unlock cookies; it does not establish Neon A/B ownership isolation. HTTP 404 is not authorization denial.",
    },
    {
      name: "duplicate_block_rejected",
      reason: "No HTTP block endpoint in alpha rebuild",
    },
    {
      name: "duplicate_unlock_rejected",
      reason: "Unlock duplicate contract is DB/integration-only in alpha rebuild",
    },
    {
      name: "user_a_cannot_modify_user_b_profile",
      reason: "No profile mutation HTTP endpoint in alpha rebuild",
    },
    {
      name: "user_a_cannot_update_or_delete_user_b_answer",
      reason: "No cross-user answer mutation HTTP endpoint in alpha rebuild",
    },
  ];

  if (!baseUrl) {
    blocked("SMOKE_BASE_URL missing");
  }

  if (!userAEmail || !userAPassword || !userBEmail || !userBPassword) {
    blocked("SMOKE_USER_A_* and SMOKE_USER_B_* credentials are required");
  }

  if (!profileAId || !profileBId) {
    blocked("SMOKE_USER_A_PROFILE_ID and SMOKE_USER_B_PROFILE_ID are required");
  }

  const previewHostname = extractHostname(baseUrl);
  if (!previewHostname) {
    blocked("SMOKE_BASE_URL must yield a Preview hostname");
  }

  const hostFailure = validateEvidenceHostname(previewHostname);
  if (hostFailure) {
    blocked(hostnameFailureMessage(hostFailure));
  }

  const reachability = await fetch(`${baseUrl}/api/auth/session`, {
    headers: previewBypass ? { "x-vercel-protection-bypass": previewBypass } : undefined,
  }).catch(() => null);

  if (!reachability) {
    blocked("Preview base URL is not reachable");
  }

  if (reachability.status === 403 && !previewBypass) {
    blocked("Preview protection requires SMOKE_VERCEL_PROTECTION_BYPASS");
  }

  const anonSession = await fetchJson("/api/auth/session");
  pushCase(
    cases,
    "anonymous_denied",
    anonSession.status === 401 && isPrivateNoStore(anonSession.headers),
  );

  const jarA = new CookieJar();
  const loginA = await signIn(userAEmail, userAPassword, jarA);
  pushCase(cases, "user_a_login", loginA.ok);
  if (!loginA.ok) {
    console.error(redact("FAIL: user A login failed — aborting later session proofs"));
    process.exit(1);
  }

  const sessionA = await fetchJson("/api/auth/session", {}, jarA);
  pushCase(cases, "user_a_session", sessionA.status === 200);

  const jarB = new CookieJar();
  const loginB = await signIn(userBEmail, userBPassword, jarB);
  pushCase(cases, "user_b_login", loginB.ok);
  if (!loginB.ok) {
    console.error(redact("FAIL: user B login failed — aborting later session proofs"));
    process.exit(1);
  }

  const sessionB = await fetchJson("/api/auth/session", {}, jarB);
  pushCase(cases, "user_b_session", sessionB.status === 200);

  pushCase(
    cases,
    "user_a_owns_session",
    sessionA.status === 200 &&
      typeof (sessionA.body as { user?: { nickname?: string } })?.user?.nickname === "string",
  );
  pushCase(
    cases,
    "user_b_owns_session",
    sessionB.status === 200 &&
      typeof (sessionB.body as { user?: { nickname?: string } })?.user?.nickname === "string",
  );

  // Mock private-profile route is NOT exercised as DB ownership proof.
  // See futureNotApplicable: db_backed_cross_user_private_profile_denial.

  const forgedReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "profile",
        targetId: profileBId,
        reason: "forged reporter attempt",
        reporterUserId: "00000000-0000-4000-8000-000000000000",
      }),
    },
    jarA,
  );
  pushCase(cases, "forged_reporter_id_rejected", forgedReport.status === 400);

  const selfReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "profile",
        targetId: profileAId,
        reason: "self report attempt",
      }),
    },
    jarA,
  );
  pushCase(cases, "self_report_rejected", selfReport.status === 400);

  const firstReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "profile",
        targetId: profileBId,
        reason: "duplicate-open-report",
      }),
    },
    jarA,
  );
  const duplicateReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "profile",
        targetId: profileBId,
        reason: "duplicate-open-report-2",
      }),
    },
    jarA,
  );
  const firstId = (firstReport.body as { id?: string })?.id;
  const duplicateId = (duplicateReport.body as { id?: string })?.id;
  pushCase(
    cases,
    "duplicate_open_report_is_idempotent",
    firstReport.status === 201 &&
      duplicateReport.status === 200 &&
      Boolean(firstId) &&
      firstId === duplicateId,
  );

  const redactionCheck = await fetchJson("/api/auth/session", {}, jarA);
  pushCase(
    cases,
    "session_response_redacted",
    redactionCheck.status === 200 && !sessionHasSensitiveFields(redactionCheck.body),
  );
  pushCase(
    cases,
    "session_response_no_store",
    redactionCheck.status === 200 && isPrivateNoStore(redactionCheck.headers),
  );

  const getSession = async (jar: CookieJar) => {
    const result = await fetchJson("/api/auth/session", {}, jar);
    return { status: result.status };
  };
  const logout = async (jar: CookieJar) => {
    const result = await fetchJson("/api/auth/logout", { method: "POST" }, jar);
    return { status: result.status };
  };

  const logoutPass = await proveLogoutInvalidatesSession({ jar: jarA, getSession, logout });
  pushCase(cases, "logout_invalidates_session", logoutPass);

  // cleared_cookie_denied — distinct from revocation
  const clearedJar = new CookieJar();
  const clearedLogin = await signIn(userAEmail, userAPassword, clearedJar);
  if (!clearedLogin.ok) {
    pushCase(cases, "cleared_cookie_denied", false);
  } else {
    const clearedPass = await proveClearedCookieDenied({ jar: clearedJar, getSession });
    pushCase(cases, "cleared_cookie_denied", clearedPass);
  }

  // revoked_session_rejected — stale pre-logout CookieJar replay only
  const revokedJar = new CookieJar();
  const revokedLogin = await signIn(userAEmail, userAPassword, revokedJar);
  if (!revokedLogin.ok) {
    pushCase(cases, "revoked_session_rejected", false);
  } else {
    const revoked = await proveRevokedSessionRejected({ jar: revokedJar, getSession, logout });
    pushCase(cases, "revoked_session_rejected", revoked.pass && revoked.usedStaleClone);
  }

  const requiredSet = new Set<string>(REQUIRED_HTTP_SMOKE_CASES);
  for (const name of REQUIRED_HTTP_SMOKE_CASES) {
    if (!cases.some((item) => item.name === name)) {
      pushCase(cases, name, false);
    }
  }

  // Drop any accidental non-required extras from pass aggregation (keep observed)
  const activeRequired = cases.filter((item) => requiredSet.has(item.name));
  const allRequiredPass =
    activeRequired.length === REQUIRED_HTTP_SMOKE_CASES.length &&
    activeRequired.every((item) => item.status === "PASS") &&
    new Set(activeRequired.map((item) => item.name)).size === REQUIRED_HTTP_SMOKE_CASES.length;

  const verdict = allRequiredPass ? "PASS" : "FAIL";

  const built = buildSmokeArtifact({
    verdict,
    gitSha: getCurrentGitSha(),
    migrationChecksum: migrationSetChecksum(),
    previewHostname,
    cases: activeRequired,
    futureNotApplicable,
  });

  if (!built.ok) {
    console.error(redact(`FAIL: smoke artifact validation failed: ${built.failures.join("; ")}`));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        verdict,
        kind: "smoke",
        matrix: "deployed_http_alpha_surface",
        previewHostname,
        runnerGitShaNote:
          "gitSha is local runner checkout provenance only — not signed remote deployment attestation",
        caseNames: activeRequired.map((item) => item.name),
        futureNotApplicable: futureNotApplicable.map((item) => item.name),
        timestamp: built.artifact.timestamp,
      },
      null,
      2,
    ),
  );

  if (!allRequiredPass) {
    console.error("FAIL: one or more required smoke cases failed");
    process.exit(1);
  }

  const out = process.env.UNSTANDARD_SMOKE_EVIDENCE_OUT?.trim();
  if (out) {
    writeProofArtifactAtomically({
      outputPath: out,
      artifact: built.artifact,
      allowOverwriteDifferentSha: process.env.UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA === "yes",
    });
    console.log(`smoke:authorization PASS artifact written`);
  } else {
    console.log("smoke:authorization PASS (no UNSTANDARD_SMOKE_EVIDENCE_OUT — artifact not written)");
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : "smoke failed"));
  process.exit(1);
});
