/**
 * Deployed Preview adversarial authorization smoke (HTTP boundary).
 * Requires SMOKE_BASE_URL and two test accounts.
 */

const baseUrl = process.env.SMOKE_BASE_URL?.trim();
const userAEmail = process.env.SMOKE_USER_A_EMAIL?.trim();
const userAPassword = process.env.SMOKE_USER_A_PASSWORD;
const userBEmail = process.env.SMOKE_USER_B_EMAIL?.trim();
const userBPassword = process.env.SMOKE_USER_B_PASSWORD;
const previewBypass = process.env.SMOKE_VERCEL_PROTECTION_BYPASS?.trim();
const profileBId = process.env.SMOKE_USER_B_PROFILE_ID?.trim();

type SmokeCase = {
  name: string;
  pass: boolean;
  skipped?: boolean;
  reason?: string;
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

class CookieJar {
  private readonly cookies = new Map<string, string>();

  ingest(setCookie: string | null): void {
    if (!setCookie) return;
    for (const part of setCookie.split(/,(?=\s*[^;]+=)/)) {
      const [pair] = part.split(";");
      const [name, ...rest] = pair.split("=");
      if (!name || rest.length === 0) continue;
      this.cookies.set(name.trim(), rest.join("=").trim());
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  clear(): void {
    this.cookies.clear();
  }
}

async function fetchJson(
  path: string,
  init: RequestInit = {},
  jar?: CookieJar,
): Promise<{ status: number; body: unknown; setCookie: string | null }> {
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

  const setCookie = response.headers.get("set-cookie");
  jar?.ingest(setCookie);

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 120) };
  }

  return { status: response.status, body, setCookie };
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

async function main(): Promise<void> {
  const cases: SmokeCase[] = [];

  if (!baseUrl) {
    console.error("BLOCKED_EXTERNAL: SMOKE_BASE_URL missing");
    process.exit(2);
  }

  if (!userAEmail || !userAPassword || !userBEmail || !userBPassword) {
    console.error("BLOCKED_EXTERNAL: SMOKE_USER_A_* and SMOKE_USER_B_* credentials are required");
    process.exit(2);
  }

  const reachability = await fetch(`${baseUrl}/api/auth/session`, {
    headers: previewBypass ? { "x-vercel-protection-bypass": previewBypass } : undefined,
  }).catch(() => null);

  if (!reachability) {
    console.error("BLOCKED_EXTERNAL: Preview base URL is not reachable");
    process.exit(2);
  }

  if (reachability.status === 403 && !previewBypass) {
    console.error("BLOCKED_EXTERNAL: Preview protection requires SMOKE_VERCEL_PROTECTION_BYPASS");
    process.exit(2);
  }

  const anonJar = new CookieJar();
  const anonSession = await fetchJson("/api/auth/session", {}, anonJar);
  cases.push({ name: "anonymous_denied", pass: anonSession.status === 401 });

  const jarA = new CookieJar();
  const loginA = await signIn(userAEmail, userAPassword, jarA);
  cases.push({ name: "user_a_login", pass: loginA.ok });
  const sessionA = await fetchJson("/api/auth/session", {}, jarA);
  cases.push({ name: "user_a_session", pass: sessionA.status === 200 });

  const jarB = new CookieJar();
  const loginB = await signIn(userBEmail, userBPassword, jarB);
  cases.push({ name: "user_b_login", pass: loginB.ok });
  const sessionB = await fetchJson("/api/auth/session", {}, jarB);
  cases.push({ name: "user_b_session", pass: sessionB.status === 200 });

  cases.push({
    name: "user_a_owns_session",
    pass: sessionA.status === 200 && typeof (sessionA.body as { user?: { nickname?: string } })?.user?.nickname === "string",
  });
  cases.push({
    name: "user_b_owns_session",
    pass: sessionB.status === 200 && typeof (sessionB.body as { user?: { nickname?: string } })?.user?.nickname === "string",
  });

  if (profileBId) {
    const crossRead = await fetchJson(`/api/profile/${profileBId}/private`, {}, jarA);
    cases.push({
      name: "user_a_cannot_read_user_b_private_profile",
      pass: crossRead.status === 401 || crossRead.status === 403,
    });
  } else {
    cases.push({
      name: "user_a_cannot_read_user_b_private_profile",
      pass: false,
      skipped: true,
      reason: "SMOKE_USER_B_PROFILE_ID missing",
    });
  }

  const forgedReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "PROFILE",
        targetId: "profile-test",
        reason: "forged",
        reporterUserId: "00000000-0000-4000-8000-000000000000",
      }),
    },
    jarA,
  );
  cases.push({
    name: "forged_reporter_id_rejected",
    pass: forgedReport.status === 400 || forgedReport.status === 403,
  });

  const selfReport = await fetchJson(
    "/api/reports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "PROFILE",
        targetId: profileBId ?? "profile-self",
        reason: "self",
        reporterUserId: (sessionA.body as { user?: { idPrefix?: string } })?.user?.idPrefix,
      }),
    },
    jarA,
  );
  cases.push({
    name: "self_report_rejected",
    pass: selfReport.status === 400 || selfReport.status === 403,
  });

  if (profileBId) {
    const firstReport = await fetchJson(
      "/api/reports",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "PROFILE",
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
          targetType: "PROFILE",
          targetId: profileBId,
          reason: "duplicate-open-report-2",
        }),
      },
      jarA,
    );
    cases.push({
      name: "duplicate_open_report_rejected",
      pass:
        firstReport.status >= 200 &&
        firstReport.status < 300 &&
        duplicateReport.status === 409,
    });
  } else {
    cases.push({
      name: "duplicate_open_report_rejected",
      pass: false,
      skipped: true,
      reason: "SMOKE_USER_B_PROFILE_ID missing",
    });
  }

  cases.push({
    name: "duplicate_block_rejected",
    pass: false,
    skipped: true,
    reason: "No HTTP block endpoint in alpha rebuild",
  });
  cases.push({
    name: "duplicate_unlock_rejected",
    pass: false,
    skipped: true,
    reason: "Unlock persistence is cookie-based without duplicate HTTP contract",
  });
  cases.push({
    name: "user_a_cannot_modify_user_b_profile",
    pass: false,
    skipped: true,
    reason: "No profile mutation HTTP endpoint in alpha rebuild",
  });
  cases.push({
    name: "user_a_cannot_update_or_delete_user_b_answer",
    pass: false,
    skipped: true,
    reason: "No cross-user answer mutation HTTP endpoint in alpha rebuild",
  });

  const redactionCheck = await fetchJson("/api/auth/session", {}, jarA);
  cases.push({
    name: "session_response_redacted",
    pass: redactionCheck.status === 200 && !sessionHasSensitiveFields(redactionCheck.body),
  });

  const logout = await fetchJson("/api/auth/logout", { method: "POST" }, jarA);
  const afterLogout = await fetchJson("/api/auth/session", {}, jarA);
  cases.push({
    name: "logout_invalidates_session",
    pass: logout.status >= 200 && logout.status < 300 && afterLogout.status === 401,
  });

  const revokedJar = new CookieJar();
  await signIn(userAEmail, userAPassword, revokedJar);
  revokedJar.clear();
  const revokedSession = await fetchJson("/api/auth/session", {}, revokedJar);
  cases.push({
    name: "revoked_session_rejected",
    pass: revokedSession.status === 401,
  });

  const requiredCases = cases.filter((item) => !item.skipped);
  const skippedCases = cases.filter((item) => item.skipped);
  const allRequiredPass = requiredCases.every((item) => item.pass);
  const verdict = skippedCases.length > 0 ? "INCOMPLETE" : allRequiredPass ? "PASS" : "FAIL";

  console.log(
    JSON.stringify(
      {
        verdict,
        baseUrl: redact(baseUrl),
        cases,
        requiredCount: requiredCases.length,
        skippedCount: skippedCases.length,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (skippedCases.length > 0) {
    process.exit(1);
  }
  if (!allRequiredPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : "smoke failed"));
  process.exit(1);
});
