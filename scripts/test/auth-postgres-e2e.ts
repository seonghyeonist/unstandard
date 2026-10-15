import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { Pool, neonConfig } from "@neondatabase/serverless";
import {
  generateEmailVerificationCode,
  hashEmailVerificationCode,
  EMAIL_VERIFICATION_TTL_MS,
} from "../../lib/auth/email-verification-crypto";
import { canonicalizeDiditWebhook } from "../../lib/identity/didit-webhook";
import { generateInviteCode, hashInviteCode } from "../../lib/auth/invite-crypto";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
} from "../../lib/legal/acceptance";

const SUITE_TIMEOUT_MS = 20 * 60 * 1_000;
const SERVER_START_TIMEOUT_MS = 90 * 1_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 90_000;
const PASSWORD_OLD = "Old-RC-account-password-913!";
const PASSWORD_NEW = "New-RC-account-password-914!";
const AUTH_SCENARIOS = [
  "proofs",
  "registration",
  "compensation-consume",
  "compensation-finalize",
  "compensation-profile",
  "profile-visibility",
  "password-reset-delete",
  "invite-replay",
  "support-lifecycle",
  "didit-security",
] as const;
type AuthScenario = (typeof AUTH_SCENARIOS)[number];

type CookieJar = Map<string, string>;
type ApiResponse = {
  status: number;
  body: Record<string, unknown>;
  setCookies: string[];
  headers: Headers;
};
type Fixture = {
  inviteId: string;
  email: string;
  rawCode: string;
  challengeId: string;
  code: string;
};
type RunningServer = {
  child: ChildProcess;
  origin: string;
  target: string;
  getDiagnostics: () => string[];
  stop: () => Promise<void>;
};

let stage = "startup";
let server: RunningServer | null = null;
let pool: Pool | null = null;
let activePrefix = "";
let activeRateLimitIp = "";
let databaseQueryNumber = 0;
let rateLimitBaselineVerified = false;

function safeCode(value: unknown): string {
  const code = (value as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,48}$/u.test(code)
    ? code
    : "UNCLASSIFIED";
}

function mustEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw Object.assign(new Error("MISSING_TEST_CONFIGURATION"), { code: "MISSING_TEST_CONFIGURATION" });
  return value;
}

function parseDatabaseTarget(url: string): { host: string; database: string } {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  return { host: parsed.hostname, database };
}

function assertSafeTarget(url: string): void {
  const { host, database } = parseDatabaseTarget(url);
  assert.equal(process.env.DATABASE_ENV, "test", "DATABASE_ENV must be test");
  assert.equal(process.env.UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST, "yes", "destructive-test confirmation is required");
  assert.equal(process.env.DATABASE_URL, url, "app DATABASE_URL must match TEST_DATABASE_URL");
  assert.equal(host.includes("-pooler"), false, "test auth transactions require the direct PostgreSQL endpoint");
  assert.match(database, /(?:test|integration|_rc_)/iu, "refusing a database without a test/RC name");
}

function writeCase(name: string, outcome: "PASS" | "FAIL" = "PASS"): void {
  console.info(JSON.stringify({ event: "auth.postgres.e2e", case: name, outcome }));
}

async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_POOL_UNAVAILABLE");
  const queryId = ++databaseQueryNumber;
  const startedAt = Date.now();
  console.info(JSON.stringify({ event: "auth.postgres.database", boundary: queryId, phase: "start" }));
  try {
    const result = await pool.query<T>(text, values);
    console.info(JSON.stringify({ event: "auth.postgres.database", boundary: queryId, phase: "end", elapsed_ms: Date.now() - startedAt, outcome: "PASS" }));
    return result.rows;
  } catch (error) {
    const code = (error as { code?: unknown; name?: unknown })?.code;
    const errorCode = typeof code === "string" && /^[A-Z0-9_]{2,40}$/u.test(code)
      ? code
      : (error as { name?: string })?.name === "TimeoutError" ? "QUERY_TIMEOUT" : "QUERY_FAILED";
    console.error(JSON.stringify({ event: "auth.postgres.database", boundary: queryId, phase: "end", elapsed_ms: Date.now() - startedAt, outcome: "FAIL", error_code: errorCode }));
    throw Object.assign(new Error(errorCode), { code: errorCode });
  }
}

function updateCookieJar(jar: CookieJar, setCookies: string[]): void {
  for (const cookie of setCookies) {
    const [pair = "", ...attributes] = cookie.split(";");
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    const normalizedAttributes = attributes.map((attribute) => attribute.trim().toLowerCase());
    if (
      normalizedAttributes.includes("max-age=0") ||
      normalizedAttributes.some((attribute) => attribute.startsWith("expires=") && Date.parse(attribute.slice(8)) < Date.now())
    ) {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

async function api(
  running: RunningServer,
  jar: CookieJar,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const headers = new Headers({
    Accept: "application/json",
    Origin: running.origin,
    Referer: `${running.origin}/`,
    // Isolate repeated runs from the DB-backed IP limiter. This address range
    // is reserved for documentation and never represents a real user.
    "X-Forwarded-For": activeRateLimitIp,
  });
  if (jar.size) headers.set("Cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const safePath = path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/giu, "/[id]");
  const startedAt = Date.now();
  console.info(JSON.stringify({ event: "auth.postgres.http", boundary: safePath, phase: "start" }));
  let response: Response;
  try {
    response = await fetch(new URL(path, running.target), {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const name = (error as { name?: unknown })?.name;
    const errorCode = name === "TimeoutError" ? "HTTP_REQUEST_TIMEOUT" : "HTTP_REQUEST_FAILED";
    console.error(JSON.stringify({ event: "auth.postgres.http", boundary: safePath, phase: "end", elapsed_ms: Date.now() - startedAt, outcome: "FAIL", error_code: errorCode }));
    throw Object.assign(new Error(errorCode), { code: errorCode });
  }
  const setCookies = response.headers.getSetCookie();
  updateCookieJar(jar, setCookies);
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // Status and stable headers are sufficient for negative-path evidence.
  }
  console.info(JSON.stringify({ event: "auth.postgres.http", boundary: safePath, phase: "end", elapsed_ms: Date.now() - startedAt, outcome: "PASS", status: response.status }));
  return { status: response.status, body, setCookies, headers: response.headers };
}

function expectStatus(response: ApiResponse, expected: number, assertionCode: string): void {
  if (response.status !== expected) {
    throw Object.assign(new Error(assertionCode), {
      code: "UNEXPECTED_HTTP_STATUS",
      assertionCode,
      actualStatus: response.status,
      expectedStatus: expected,
      responseError: response.body.error,
    });
  }
}

function expectAnyError(response: ApiResponse, assertionCode: string): void {
  if (response.status < 400) {
    throw Object.assign(new Error(assertionCode), {
      code: "UNEXPECTED_SUCCESS_STATUS",
      assertionCode,
      actualStatus: response.status,
    });
  }
}

async function reserveFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => resolve());
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("PORT_ALLOCATION_FAILED");
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(injection?: "consume" | "finalize" | "profile"): Promise<RunningServer> {
  const port = await reserveFreePort();
  const origin = `http://localhost:${port}`;
  const target = `http://127.0.0.1:${port}`;
  const env = { ...process.env };
  env.NODE_ENV = "production";
  env.PORT = String(port);
  env.HOSTNAME = "127.0.0.1";
  env.UNSTANDARD_RUNTIME_MODE = "database";
  env.UNSTANDARD_TEST_POSTGRES_WEBSOCKET = "yes";
  env.DATABASE_ENV = "test";
  env.DATABASE_URL = mustEnv("TEST_DATABASE_URL");
  env.BETTER_AUTH_URL = origin;
  env.UNSTANDARD_APP_URL = origin;
  if (process.argv[2] === "didit-security") {
    env.UNSTANDARD_APP_URL = "https://isolated-synthetic.example.test";
    env.UNSTANDARD_IDENTITY_ENABLED = "true";
    env.DIDIT_EXPECTED_ENVIRONMENT = "sandbox";
    env.DIDIT_API_KEY = "synthetic-test-no-provider-access";
    env.DIDIT_WORKFLOW_ID = "11111111-1111-4111-8111-111111111111";
    env.DIDIT_WEBHOOK_SECRET = mustEnv("DIDIT_WEBHOOK_SECRET");
  }
  env.BETTER_AUTH_SECRET = mustEnv("BETTER_AUTH_SECRET");
  env.ALPHA_INVITE_PEPPER = mustEnv("ALPHA_INVITE_PEPPER");
  env.ALPHA_EMAIL_VERIFICATION_PEPPER = mustEnv("ALPHA_EMAIL_VERIFICATION_PEPPER");
  delete env.RESEND_API_KEY;
  delete env.UNSTANDARD_EMAIL_FROM;
  if (injection) env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE = injection;
  else delete env.UNSTANDARD_TEST_INJECT_FINALIZE_FAILURE;

  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  // Keep runtime output in memory for diagnosis without streaming cookies,
  // reset links, email codes, database URLs, or synthetic account values.
  let buffered = "";
  const capture = (chunk: Buffer) => {
    buffered = (buffered + chunk.toString("utf8")).slice(-64_000);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);

  let ready = false;
  const startedAt = Date.now();
  console.info(JSON.stringify({ event: "auth.postgres.server", phase: "start", injection: injection ?? "none" }));
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw Object.assign(new Error("PREVIEW_SERVER_EXITED_DURING_START"), { code: "PREVIEW_SERVER_EXITED" });
    }
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(2_000), redirect: "manual" });
      await response.body?.cancel();
      ready = response.status < 500;
      if (ready) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) {
    child.kill("SIGKILL");
    void buffered;
    throw Object.assign(new Error("PREVIEW_SERVER_START_TIMEOUT"), { code: "PREVIEW_SERVER_START_TIMEOUT" });
  }

  let stopped = false;
  const running: RunningServer = {
    child,
    origin,
    target,
    getDiagnostics: () => buffered
      .split("\n")
      .filter((line) => /error|fail|timeout|neon|postgres|database|transaction/iu.test(line))
      .slice(-12)
      .map((line) => {
        let sanitized = line;
        for (const [key, value] of Object.entries(env)) {
          if (value && /url|secret|password|token|pepper|code|email/iu.test(key)) sanitized = sanitized.replaceAll(value, "[REDACTED]");
        }
        return sanitized
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, "[REDACTED_DATABASE_URL]")
          .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[REDACTED_EMAIL]")
          .replace(/((?:password|token|secret|code)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, "$1[REDACTED]");
      }),
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      const exited = await Promise.race([
        new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SERVER_STOP_TIMEOUT_MS)),
      ]);
      if (!exited && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    },
  };
  console.info(JSON.stringify({ event: "auth.postgres.server", phase: "ready", injection: injection ?? "none", elapsed_ms: Date.now() - startedAt }));
  return running;
}

async function insertInvite(email: string): Promise<{ id: string; rawCode: string }> {
  const id = randomUUID();
  const rawCode = generateInviteCode();
  const codeHash = hashInviteCode(rawCode, mustEnv("ALPHA_INVITE_PEPPER"));
  await query(
    `INSERT INTO alpha_invites
      (id,email_normalized,code_hash,status,expires_at,target_phase,recruitment_cohort,acquisition_channel,balance_bucket)
     VALUES ($1,$2,$3,'pending',now() + interval '7 days','alpha_stage_1','founder_network','founder_direct','not_counted')`,
    [id, email, codeHash],
  );
  const [proof] = await query<{ code_match: boolean; email_match: boolean; valid: boolean }>(
    `SELECT code_hash=$2 AS code_match, email_normalized=$3 AS email_match,
       status='pending' AND target_phase='alpha_stage_1' AND expires_at > now() AS valid
     FROM alpha_invites WHERE id=$1`,
    [id, codeHash, email],
  );
  assert.equal(proof?.code_match, true, "FIXTURE_INVITE_HASH_MISMATCH");
  assert.equal(proof?.email_match, true, "FIXTURE_INVITE_EMAIL_MISMATCH");
  assert.equal(proof?.valid, true, "FIXTURE_INVITE_ROW_INVALID");
  return { id, rawCode };
}

async function insertChallenge(inviteId: string, email: string): Promise<{ id: string; code: string }> {
  const id = randomUUID();
  const code = generateEmailVerificationCode();
  const codeHash = hashEmailVerificationCode(id, email, code, mustEnv("ALPHA_EMAIL_VERIFICATION_PEPPER"));
  await query(
    `INSERT INTO alpha_email_verifications
      (id,invite_id,email_normalized,code_hash,attempt_count,sent_at,expires_at)
     VALUES ($1,$2,$3,$4,0,now(),$5)`,
    [id, inviteId, email, codeHash, new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)],
  );
  return { id, code };
}

async function makeFixture(label: string): Promise<Fixture> {
  const email = `${activePrefix}${label}@example.test`;
  const invite = await insertInvite(email);
  const challenge = await insertChallenge(invite.id, email);
  return {
    inviteId: invite.id,
    email,
    rawCode: invite.rawCode,
    challengeId: challenge.id,
    code: challenge.code,
  };
}

async function beginRegistration(running: RunningServer, fixture: Fixture, jar: CookieJar): Promise<void> {
  const prepared = await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } });
  expectStatus(prepared, 200, "PREPARE_INVITE_REJECTED");
  const preparedCookie = prepared.setCookies.find((cookie) => cookie.startsWith("unstandard_prepared_invite="));
  assert.ok(preparedCookie, "PREPARED_INVITE_COOKIE_MISSING");
  for (const flag of ["httponly", "secure", "samesite=lax", "path=/"]) {
    assert.ok(preparedCookie!.toLowerCase().includes(flag), `PREPARED_INVITE_COOKIE_MISSING_${flag.toUpperCase()}`);
  }

  expectStatus(
    await api(running, jar, "/api/alpha/invite/email/verify", {
      body: { challengeId: fixture.challengeId, code: fixture.code },
    }),
    200,
    "EMAIL_PROOF_REJECTED",
  );
  expectStatus(
    await api(running, jar, "/api/alpha/invite/claim", {
      body: {
        adultConfirmed: true,
        termsAccepted: true,
        safetyRulesAccepted: true,
        termsVersion: CLOSED_ALPHA_TERMS_VERSION,
        safetyRulesVersion: CLOSED_ALPHA_SAFETY_RULES_VERSION,
      },
    }),
    200,
    "LEGAL_CLAIM_REJECTED",
  );
}

async function register(running: RunningServer, fixture: Fixture, jar: CookieJar): Promise<ApiResponse> {
  return api(running, jar, "/api/auth/sign-up/email", {
    body: { name: "Synthetic Alpha Member", email: fixture.email, password: PASSWORD_OLD },
  });
}

async function authSnapshot(email: string, inviteId: string, challengeId: string) {
  const [row] = await query<{
    users: number; accounts: number; sessions: number; legal: number; profiles: number;
    invite_status: string | null; proof_verified: boolean; proof_consumed: boolean; proof_invalidated: boolean;
  }>(
    `SELECT
       (SELECT count(*)::int FROM users WHERE email=$1) AS users,
       (SELECT count(*)::int FROM accounts a JOIN users u ON u.id=a.user_id WHERE u.email=$1) AS accounts,
       (SELECT count(*)::int FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email=$1) AS sessions,
       (SELECT count(*)::int FROM legal_acceptances l JOIN users u ON u.id=l.user_id WHERE u.email=$1) AS legal,
       (SELECT count(*)::int FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.email=$1) AS profiles,
       (SELECT status FROM alpha_invites WHERE id=$2) AS invite_status,
       (SELECT verified_at IS NOT NULL FROM alpha_email_verifications WHERE id=$3) AS proof_verified,
       (SELECT consumed_at IS NOT NULL FROM alpha_email_verifications WHERE id=$3) AS proof_consumed,
       (SELECT invalidated_at IS NOT NULL FROM alpha_email_verifications WHERE id=$3) AS proof_invalidated`,
    [email, inviteId, challengeId],
  );
  return row!;
}

function assertNoAccountFootprint(snapshot: Awaited<ReturnType<typeof authSnapshot>>, code: string): void {
  assert.equal(Number(snapshot.users), 0, `${code}_USER_ORPHAN`);
  assert.equal(Number(snapshot.accounts), 0, `${code}_ACCOUNT_ORPHAN`);
  assert.equal(Number(snapshot.sessions), 0, `${code}_SESSION_ORPHAN`);
  assert.equal(Number(snapshot.legal), 0, `${code}_LEGAL_PARTIAL_COMMIT`);
  assert.equal(Number(snapshot.profiles), 0, `${code}_PROFILE_ORPHAN`);
}

async function testPreAuthBaseline(): Promise<void> {
  const [counts] = await query<{ users: number; accounts: number; sessions: number; invites: number; proofs: number; rate_limits: number }>(
    `SELECT
       (SELECT count(*)::int FROM users) users,
       (SELECT count(*)::int FROM accounts) accounts,
       (SELECT count(*)::int FROM sessions) sessions,
       (SELECT count(*)::int FROM alpha_invites) invites,
       (SELECT count(*)::int FROM alpha_email_verifications) proofs,
       (SELECT count(*)::int FROM rate_limits) rate_limits`,
  );
  assert.deepEqual(counts, { users: 0, accounts: 0, sessions: 0, invites: 0, proofs: 0, rate_limits: 0 }, "AUTH_E2E_DATABASE_NOT_ROW_CLEAN");
  rateLimitBaselineVerified = true;
  writeCase("fresh_pre_auth_zero_counts");
}

async function testInvalidProofs(running: RunningServer): Promise<void> {
  {
    stage = "invalid_proof_wrong_code";
    const fixture = await makeFixture("wrong-code");
    const jar: CookieJar = new Map();
    const prepared = await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } });
    expectStatus(prepared, 200, "WRONG_CODE_PREPARE_FAILED");
    const result = await api(running, jar, "/api/alpha/invite/email/verify", {
      body: { challengeId: fixture.challengeId, code: fixture.code === "000000" ? "000001" : "000000" },
    });
    expectStatus(result, 422, "WRONG_CODE_ACCEPTED");
    assertNoAccountFootprint(await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId), "WRONG_CODE");
  }
  writeCase("wrong_email_code_rejected_no_auth_rows");

  {
    stage = "invalid_proof_wrong_invite_email_relationship";
    const first = await makeFixture("wrong-relationship-a");
    const second = await makeFixture("wrong-relationship-b");
    const jar: CookieJar = new Map();
    expectStatus(await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: first.rawCode } }), 200, "RELATIONSHIP_PREPARE_FAILED");
    expectStatus(
      await api(running, jar, "/api/alpha/invite/email/verify", {
        body: { challengeId: second.challengeId, code: second.code },
      }),
      422,
      "WRONG_INVITE_EMAIL_RELATIONSHIP_ACCEPTED",
    );
    assertNoAccountFootprint(await authSnapshot(first.email, first.inviteId, first.challengeId), "WRONG_RELATIONSHIP");
  }
  writeCase("wrong_invite_email_relationship_rejected");

  {
    stage = "invalid_proof_expired";
    const fixture = await makeFixture("expired-proof");
    await query("UPDATE alpha_email_verifications SET expires_at=now() - interval '1 second' WHERE id=$1", [fixture.challengeId]);
    const jar: CookieJar = new Map();
    expectStatus(await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } }), 200, "EXPIRED_PREPARE_FAILED");
    expectStatus(
      await api(running, jar, "/api/alpha/invite/email/verify", {
        body: { challengeId: fixture.challengeId, code: fixture.code },
      }),
      410,
      "EXPIRED_PROOF_ACCEPTED",
    );
    assertNoAccountFootprint(await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId), "EXPIRED_PROOF");
  }
  writeCase("expired_proof_rejected");

  {
    stage = "invalid_proof_invalidated";
    const fixture = await makeFixture("invalidated-proof");
    await query("UPDATE alpha_email_verifications SET invalidated_at=now() WHERE id=$1", [fixture.challengeId]);
    const jar: CookieJar = new Map();
    expectStatus(await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } }), 200, "INVALIDATED_PREPARE_FAILED");
    expectStatus(
      await api(running, jar, "/api/alpha/invite/email/verify", {
        body: { challengeId: fixture.challengeId, code: fixture.code },
      }),
      422,
      "INVALIDATED_PROOF_ACCEPTED",
    );
    assertNoAccountFootprint(await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId), "INVALIDATED_PROOF");
  }
  writeCase("invalidated_proof_rejected");

  {
    stage = "invalid_proof_replayed";
    const fixture = await makeFixture("replayed-proof");
    const jar: CookieJar = new Map();
    expectStatus(await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } }), 200, "REPLAY_PREPARE_FAILED");
    expectStatus(await api(running, jar, "/api/alpha/invite/email/verify", { body: { challengeId: fixture.challengeId, code: fixture.code } }), 200, "INITIAL_PROOF_REJECTED");
    expectStatus(await api(running, jar, "/api/alpha/invite/prepare", { body: { capability: fixture.rawCode } }), 200, "REPLAY_REPREPARE_FAILED");
    expectStatus(await api(running, jar, "/api/alpha/invite/email/verify", { body: { challengeId: fixture.challengeId, code: fixture.code } }), 422, "REPLAYED_PROOF_ACCEPTED");
    assertNoAccountFootprint(await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId), "REPLAYED_PROOF");
  }
  writeCase("replayed_proof_rejected");
}

async function testFailureCompensation(injection: "consume" | "finalize" | "profile"): Promise<void> {
  const fixture = await makeFixture(`injected-${injection}`);
  const jar: CookieJar = new Map();
  await beginRegistration(server!, fixture, jar);
  await server!.stop();
  server = await startServer(injection);
  const failed = await register(server, fixture, jar);
  expectAnyError(failed, `INJECTION_${injection.toUpperCase()}_DID_NOT_FAIL`);

  const afterFailure = await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId);
  assertNoAccountFootprint(afterFailure, `INJECTION_${injection.toUpperCase()}`);
  assert.equal(afterFailure.invite_status, "reserved", `INJECTION_${injection.toUpperCase()}_INVITE_NOT_RETRYABLE`);
  assert.equal(afterFailure.proof_verified, true, `INJECTION_${injection.toUpperCase()}_PROOF_NOT_VERIFIED`);
  assert.equal(afterFailure.proof_consumed, false, `INJECTION_${injection.toUpperCase()}_PROOF_PARTIALLY_CONSUMED`);
  assert.equal(afterFailure.proof_invalidated, false, `INJECTION_${injection.toUpperCase()}_PROOF_INVALIDATED`);

  await server.stop();
  server = await startServer();
  const retried = await register(server, fixture, jar);
  expectStatus(retried, 200, `INJECTION_${injection.toUpperCase()}_RETRY_FAILED`);
  const afterRetry = await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId);
  assert.equal(Number(afterRetry.users), 1, `INJECTION_${injection.toUpperCase()}_RETRY_USER_MISSING`);
  assert.equal(Number(afterRetry.accounts), 1, `INJECTION_${injection.toUpperCase()}_RETRY_ACCOUNT_MISSING`);
  assert.equal(Number(afterRetry.sessions), 1, `INJECTION_${injection.toUpperCase()}_RETRY_SESSION_MISSING`);
  assert.equal(Number(afterRetry.legal), 1, `INJECTION_${injection.toUpperCase()}_RETRY_LEGAL_MISSING`);
  assert.equal(Number(afterRetry.profiles), 1, `INJECTION_${injection.toUpperCase()}_RETRY_PROFILE_MISSING`);
  assert.equal(afterRetry.invite_status, "consumed", `INJECTION_${injection.toUpperCase()}_RETRY_INVITE_NOT_CONSUMED`);
  assert.equal(afterRetry.proof_consumed, true, `INJECTION_${injection.toUpperCase()}_RETRY_PROOF_NOT_CONSUMED`);
  writeCase(`failure_compensation_${injection}_and_retry`);
}

async function signIn(running: RunningServer, email: string, password: string, jar: CookieJar): Promise<ApiResponse> {
  return api(running, jar, "/api/auth/sign-in/email", { body: { email, password } });
}

async function testNormalRegistrationAndExistingAccount(): Promise<{ fixture: Fixture; jar: CookieJar }> {
  const fixture = await makeFixture("normal-account");
  const jar: CookieJar = new Map();
  await beginRegistration(server!, fixture, jar);
  expectStatus(await register(server!, fixture, jar), 200, "NORMAL_REGISTRATION_FAILED");

  const signedInSession = await api(server!, jar, "/api/auth/session");
  expectStatus(signedInSession, 200, "NEW_SESSION_NOT_READABLE");
  assert.match(signedInSession.headers.get("cache-control") ?? "", /private.*no-store/iu, "SESSION_CACHE_NOT_PRIVATE_NO_STORE");
  assert.equal(signedInSession.headers.get("vary")?.toLowerCase().includes("cookie"), true, "SESSION_RESPONSE_MISSING_VARY_COOKIE");
  const successful = await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId);
  assert.equal(Number(successful.users), 1);
  assert.equal(Number(successful.accounts), 1);
  assert.equal(Number(successful.sessions), 1);
  assert.equal(Number(successful.legal), 1);
  assert.equal(Number(successful.profiles), 1);
  assert.equal(successful.invite_status, "consumed");
  assert.equal(successful.proof_consumed, true);
  writeCase("normal_invite_registration_and_database_deltas");

  expectStatus(await api(server!, jar, "/api/auth/logout", { body: {} }), 200, "INITIAL_LOGOUT_FAILED");
  expectStatus(await api(server!, jar, "/api/auth/session"), 401, "LOGGED_OUT_SESSION_REMAINS_VALID");
  assert.equal(Number((await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId)).sessions), 0);

  const relogin = await signIn(server!, fixture.email, PASSWORD_OLD, jar);
  expectStatus(relogin, 200, "EXISTING_CREDENTIAL_LOGIN_FAILED");
  expectStatus(await api(server!, jar, "/api/auth/session"), 200, "EXISTING_ACCOUNT_SESSION_FAILED");
  writeCase("existing_credential_account_signin_and_session");
  return { fixture, jar };
}

async function testProfileOnboardingAndPrivacy(fixture: Fixture, jar: CookieJar): Promise<void> {
  const before = await api(server!, jar, "/api/profile/basics");
  expectStatus(before, 200, "PROFILE_SETUP_READ_FAILED");
  assert.equal(before.body.eligible, false, "UNVERIFIED_PROFILE_SHOULD_NOT_BE_ELIGIBLE");

  const saved = await api(server!, jar, "/api/profile/basics", {
    method: "PUT",
    body: {
      nickname: "알파 테스트",
      gender: "female",
      age: 31,
      region: "서울",
      introductionScopeAccepted: true,
      profileConsentAccepted: true,
      profileConsentVersion: "alpha-basic-profile-v1",
      introductionScopeVersion: "alpha-opposite-gender-v1",
    },
  });
  expectStatus(saved, 200, "PROFILE_BASICS_SAVE_FAILED");
  assert.equal(saved.body.eligible, false, "UNVERIFIED_PROFILE_BECAME_ELIGIBLE");

  const onboarding = await api(server!, jar, "/api/onboarding/answer", {
    body: {
      nickname: "알파 테스트",
      answer: "비가 그친 뒤 골목을 천천히 걸었어요. 따뜻한 차를 마시며 오늘 있었던 일을 정리하니 마음이 조금 편안해졌습니다.",
    },
  });
  // The first answer creates a row, so the route correctly returns 201.
  expectStatus(onboarding, 201, "FIRST_QUESTION_ANSWER_FAILED");
  assert.equal(onboarding.body.source, undefined, "ONBOARDING_RESPONSE_LEAKED_SCORER_SOURCE");
  assert.equal(onboarding.body.modelVersion, undefined, "ONBOARDING_RESPONSE_LEAKED_SCORER_VERSION");

  const user = await query<{ id: string }>("SELECT id FROM users WHERE email=$1", [fixture.email]);
  const profiles = await query<{ id: string }>("SELECT id::text FROM profiles WHERE user_id=$1", [user[0]?.id]);
  assert.ok(profiles[0]?.id, "PROFILE_BOOTSTRAP_MISSING");
  const candidates = await api(server!, jar, "/api/candidates");
  expectStatus(candidates, 409, "UNVERIFIED_VIEWER_WAS_EXPOSED_TO_CANDIDATES");
  const direct = await api(server!, jar, `/api/profile/${profiles[0]!.id}`);
  expectStatus(direct, 404, "UNVERIFIED_PROFILE_WAS_DIRECTLY_EXPOSED");
  writeCase("profile_setup_first_answer_and_unverified_visibility_denied");

  const targetUserId = randomUUID();
  const targetProfileId = randomUUID();
  const targetEmail = `${activePrefix}block-target-${randomUUID()}@example.test`;
  await query(
    `INSERT INTO users (id, name, email, email_verified, invite_finalized_at)
     VALUES ($1, $2, $3, true, now())`,
    [targetUserId, "Synthetic Block Target", targetEmail],
  );
  await query(
    `INSERT INTO profiles (id, user_id, nickname, onboarded_at)
     VALUES ($1, $2, $3, now())`,
    [targetProfileId, targetUserId, "Synthetic Block Target"],
  );

  const unauthenticatedBlock = await api(server!, new Map(), "/api/blocks", {
    body: { profileId: targetProfileId },
  });
  expectStatus(unauthenticatedBlock, 401, "BLOCK_ACTION_ALLOWED_WITHOUT_SESSION");
  const invalidBlock = await api(server!, jar, "/api/blocks", {
    body: { profileId: "invalid-profile-id" },
  });
  expectStatus(invalidBlock, 400, "BLOCK_ACTION_ACCEPTED_INVALID_PROFILE_ID");

  const blocked = await api(server!, jar, "/api/blocks", {
    body: { profileId: targetProfileId },
  });
  expectStatus(blocked, 201, "BLOCK_ACTION_FAILED");
  assert.equal(blocked.body.blocked, true, "BLOCK_ACTION_RESPONSE_MISSING_BLOCK_STATE");
  assert.equal(blocked.body.inserted, true, "BLOCK_ACTION_DID_NOT_INSERT_BLOCK");
  assert.match(blocked.headers.get("cache-control") ?? "", /private.*no-store/iu, "BLOCK_RESPONSE_NOT_PRIVATE_NO_STORE");

  const repeatedBlock = await api(server!, jar, "/api/blocks", {
    body: { profileId: targetProfileId },
  });
  expectStatus(repeatedBlock, 200, "REPEATED_BLOCK_NOT_IDEMPOTENT");
  assert.equal(repeatedBlock.body.blocked, true);
  assert.equal(repeatedBlock.body.inserted, false);

  const [viewer] = await query<{ id: string }>("SELECT id FROM users WHERE email=$1", [fixture.email]);
  assert.ok(viewer?.id, "BLOCK_VIEWER_MISSING");
  const [persistedBlock] = await query<{ count: number }>(
    "SELECT count(*)::int AS count FROM blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2",
    [viewer.id, targetUserId],
  );
  assert.equal(Number(persistedBlock?.count), 1, "BLOCK_ROW_NOT_PERSISTED_ONCE");

  const blockedConversation = await api(server!, jar, `/api/messages/${targetProfileId}`);
  expectStatus(blockedConversation, 403, "BLOCKED_CONVERSATION_REMAINED_READABLE");
  assert.equal(blockedConversation.body.code, "BLOCKED", "BLOCKED_CONVERSATION_WRONG_DENIAL");
  const blockedMessage = await api(server!, jar, `/api/messages/${targetProfileId}`, {
    body: { body: "Synthetic post-block message" },
  });
  expectStatus(blockedMessage, 403, "BLOCKED_MESSAGE_WAS_SENT");
  assert.equal(blockedMessage.body.code, "BLOCKED", "BLOCKED_MESSAGE_WRONG_DENIAL");
  const [messageCount] = await query<{ count: number }>(
    "SELECT count(*)::int AS count FROM messages WHERE sender_user_id=$1 AND recipient_user_id=$2",
    [viewer.id, targetUserId],
  );
  assert.equal(Number(messageCount?.count), 0, "POST_BLOCK_MESSAGE_ROW_CREATED");
  writeCase("block_action_persists_and_denies_post_block_messaging");

  expectStatus(await api(server!, jar, "/api/profile/basics", { method: "DELETE" }), 200, "PROFILE_WITHDRAWAL_FAILED");
  const afterWithdrawal = await api(server!, jar, "/api/profile/basics");
  expectStatus(afterWithdrawal, 200, "WITHDRAWN_PROFILE_READ_FAILED");
  assert.equal(afterWithdrawal.body.basics, null, "PROFILE_BASICS_NOT_WITHDRAWN");
  assert.equal(afterWithdrawal.body.eligible, false);
  writeCase("profile_withdrawal_reduces_visibility");
}

async function testDiditSecurity(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const secret = mustEnv("DIDIT_WEBHOOK_SECRET");
  const body = { event_id: randomUUID(), webhook_type: "status.updated", timestamp: now, session_id: randomUUID(), vendor_data: randomUUID(), environment: "sandbox", workflow_id: "11111111-1111-4111-8111-111111111111", status: "Approved" };
  const sign = (payload: unknown) => createHmac("sha256", secret).update(canonicalizeDiditWebhook(payload), "utf8").digest("hex");
  async function post(payload: unknown, signature: string | null, timestamp: number, expected: number, name: string) {
    const headers: Record<string,string> = { "Content-Type": "application/json", "x-timestamp": String(timestamp) };
    if (signature) headers["x-signature-v2"] = signature;
    const response = await fetch(new URL("/api/identity/webhook", server!.target), { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    assert.equal(response.status, expected, name);
    assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/iu);
    writeCase(name);
  }
  await post(body, null, now, 401, "didit_missing_signature_denied");
  await post(body, "0".repeat(64), now, 401, "didit_invalid_signature_denied");
  await post({ ...body, status: "Declined" }, sign(body), now, 401, "didit_tampered_body_denied");
  const old = { ...body, timestamp: now - 301 };
  await post(old, sign(old), old.timestamp, 401, "didit_stale_signed_body_denied");
  await post(old, sign(old), now, 401, "didit_fresh_header_cannot_revive_stale_body");
  const live = { ...body, environment: "live" };
  await post(live, sign(live), now, 401, "didit_signed_environment_mismatch_denied");
  const workflow = { ...body, workflow_id: randomUUID() };
  await post(workflow, sign(workflow), now, 401, "didit_signed_workflow_mismatch_denied");
  await post(body, sign(body), now, 200, "didit_unknown_request_ignored");
  await post(body, sign(body), now, 200, "didit_unknown_request_replay_ignored");
  const [counts] = await query<{ identities: number; queued: number }>("SELECT (SELECT count(*)::int FROM identity_verifications) identities, (SELECT count(*)::int FROM identity_provider_purge_queue) queued");
  assert.deepEqual(counts, { identities: 0, queued: 0 });
  writeCase("didit_negative_matrix_has_no_identity_or_provider_purge_side_effect");
}

async function testSupportLifecycle(fixture: Fixture, jar: CookieJar): Promise<void> {
  await testProfileOnboardingAndPrivacy(fixture, jar);
  expectStatus(await api(server!, jar, "/api/profile/basics", { method: "DELETE" }), 200, "PROFILE_WITHDRAW_FAILED");
  const [withdrawn] = await query<{ count: number }>("SELECT count(*)::int AS count FROM profile_basics b JOIN users u ON u.id=b.user_id WHERE u.email=$1", [fixture.email]);
  assert.equal(withdrawn?.count, 0, "PROFILE_WITHDRAW_RESIDUAL");
  writeCase("profile_withdrawal_removes_basics_without_verified_identity_fixture");
  expectStatus(await api(server!, new Map(), "/api/support"), 401, "ANONYMOUS_SUPPORT_READ");
  expectStatus(await api(server!, new Map(), "/api/alpha/operator/support"), 403, "ANONYMOUS_OPERATOR_READ");
  expectStatus(await api(server!, jar, "/api/alpha/operator/support", { body: {} }), 403, "MEMBER_OPERATOR_ESCALATION");
  const created = await api(server!, jar, "/api/support", { body: { category: "technical", message: "Synthetic support lifecycle request only." } });
  expectStatus(created, 201, "SUPPORT_CREATE_FAILED");
  const ticketId = created.body.ticketId;
  const second = await makeFixture("support-other-member");
  const secondJar: CookieJar = new Map();
  await beginRegistration(server!, second, secondJar);
  expectStatus(await register(server!, second, secondJar), 200, "SECOND_SUPPORT_MEMBER_FAILED");
  const other = await api(server!, secondJar, "/api/support");
  expectStatus(other, 200, "SECOND_MEMBER_SUPPORT_READ_FAILED");
  assert.deepEqual(other.body.tickets, [], "CROSS_MEMBER_SUPPORT_LEAK");
  const operatorJar: CookieJar = new Map();
  expectStatus(await api(server!, operatorJar, "/api/alpha/operator/login", { body: { token: mustEnv("UNSTANDARD_INVITE_OPERATOR_TOKEN") } }), 200, "OPERATOR_LOGIN_FAILED");
  const inventory = await api(server!, operatorJar, "/api/alpha/operator/support");
  expectStatus(inventory, 200, "OPERATOR_SUPPORT_READ_FAILED");
  assert.match(inventory.headers.get("cache-control") ?? "", /private.*no-store/iu);
  const ticket = (inventory.body.tickets as { id: string; status: string; updatedAt: string }[]).find(t => t.id === ticketId);
  assert.ok(ticket, "SUPPORT_TICKET_MISSING");
  const update = { ticketId, expectedStatus: ticket.status, expectedUpdatedAt: ticket.updatedAt, status: "CLOSED", assignedTo: "seonghyeonist", response: "Synthetic support response delivered in the member inbox." };
  const crossOrigin = await fetch(new URL("/api/alpha/operator/support", server!.target), { method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json", Cookie: [...operatorJar].map(([k,v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify(update) });
  assert.equal(crossOrigin.status, 403, "CROSS_ORIGIN_SUPPORT_WRITE");
  const concurrent = await Promise.all([api(server!, operatorJar, "/api/alpha/operator/support", { body: update }), api(server!, operatorJar, "/api/alpha/operator/support", { body: update })]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200,409], "SUPPORT_CONCURRENT_DUPLICATE_RESPONSE");
  const inbox = await api(server!, jar, "/api/support");
  const own = (inbox.body.tickets as { id: string; status: string; replies: { response: string }[] }[]).find(t => t.id === ticketId);
  assert.equal(own?.status, "CLOSED"); assert.equal(own?.replies.length, 1); assert.equal(own?.replies[0]?.response, update.response);
  const [audit] = await query<{ count: number; assigned: boolean }>("SELECT count(*)::int AS count, bool_and(assigned_to='seonghyeonist' AND actor IN ('member','invite_operator')) AS assigned FROM support_events WHERE ticket_id=$1", [ticketId]);
  assert.equal(audit?.count, 2); assert.equal(audit?.assigned, true);
  writeCase("support_owner_reply_member_isolation_csrf_audit_concurrent_replay");
  const stale = new Map(jar);
  expectStatus(await api(server!, jar, "/api/auth/logout", { body: {} }), 200, "LIFECYCLE_LOGOUT_FAILED");
  expectStatus(await api(server!, stale, "/api/auth/session"), 401, "STALE_LOGOUT_COOKIE_ACCEPTED");
  expectStatus(await signIn(server!, fixture.email, PASSWORD_OLD, jar), 200, "LIFECYCLE_PASSWORD_LOGIN_FAILED");
  expectAnyError(await api(server!, jar, "/api/auth/delete-user", { body: {} }), "PASSWORDLESS_DELETE_ALLOWED");
  expectAnyError(await api(server!, jar, "/api/auth/delete-user", { body: { password: "Wrong-password-20261009!" } }), "WRONG_PASSWORD_DELETE_ALLOWED");
  const staleDelete = new Map(jar);
  expectStatus(await api(server!, jar, "/api/auth/delete-user", { body: { password: PASSWORD_OLD } }), 200, "LIFECYCLE_CORRECT_PASSWORD_DELETE_FAILED");
  expectStatus(await api(server!, staleDelete, "/api/auth/session"), 401, "STALE_DELETED_SESSION_ACCEPTED");
  assertNoAccountFootprint(await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId), "LIFECYCLE_DELETE");
  expectAnyError(await signIn(server!, fixture.email, PASSWORD_OLD, new Map()), "DELETED_ACCOUNT_LOGIN_ALLOWED");
  const [residual] = await query<{ tickets: number; events: number }>("SELECT (SELECT count(*)::int FROM support_requests WHERE id=$1) tickets, (SELECT count(*)::int FROM support_events WHERE ticket_id=$1) events", [ticketId]);
  assert.deepEqual(residual, { tickets: 0, events: 0 });
  writeCase("password_login_logout_stale_cookie_wrong_password_delete_cascade_no_reset");
}

async function testPasswordResetLogoutAndDeletion(fixture: Fixture, jar: CookieJar): Promise<void> {
  const requestReset = await api(server!, new Map(), "/api/auth/request-password-reset", {
    body: { email: fixture.email },
  });
  expectStatus(requestReset, 200, "PASSWORD_RESET_REQUEST_FAILED");

  const user = await query<{ id: string }>("SELECT id FROM users WHERE email=$1", [fixture.email]);
  assert.ok(user[0]?.id, "PASSWORD_RESET_USER_MISSING");
  const resetRows = await query<{ token: string }>(
    `SELECT substring(identifier from 16) AS token FROM verifications
     WHERE identifier LIKE 'reset-password:%' AND value=$1 ORDER BY created_at DESC LIMIT 1`,
    [user[0]!.id],
  );
  const resetToken = resetRows[0]?.token;
  assert.ok(resetToken, "RESET_TOKEN_NOT_CREATED");
  const reset = await api(server!, new Map(), "/api/auth/reset-password", {
    body: { token: resetToken, newPassword: PASSWORD_NEW },
  });
  expectStatus(reset, 200, "PASSWORD_RESET_FAILED");

  expectStatus(await api(server!, jar, "/api/auth/session"), 401, "OLD_SESSION_SURVIVED_PASSWORD_RESET");
  assert.equal(Number((await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId)).sessions), 0);
  const oldPassword = await signIn(server!, fixture.email, PASSWORD_OLD, new Map());
  expectAnyError(oldPassword, "OLD_PASSWORD_STILL_WORKS");
  const newJar: CookieJar = new Map();
  expectStatus(await signIn(server!, fixture.email, PASSWORD_NEW, newJar), 200, "NEW_PASSWORD_LOGIN_FAILED");
  const replay = await api(server!, new Map(), "/api/auth/reset-password", {
    body: { token: resetToken, newPassword: "Replay-RC-password-915!" },
  });
  expectAnyError(replay, "RESET_TOKEN_REPLAY_ACCEPTED");
  writeCase("password_reset_old_session_revoked_old_password_rejected_new_password_valid_replay_denied");

  assert.equal(Number((await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId)).sessions), 1);
  expectStatus(await api(server!, newJar, "/api/auth/logout", { body: {} }), 200, "LOGOUT_FAILED");
  expectStatus(await api(server!, newJar, "/api/auth/session"), 401, "LOGOUT_DID_NOT_INVALIDATE_SESSION");
  assert.equal(Number((await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId)).sessions), 0);
  writeCase("logout_invalidates_database_session");

  const deletionJar: CookieJar = new Map();
  expectStatus(await signIn(server!, fixture.email, PASSWORD_NEW, deletionJar), 200, "PRE_DELETE_LOGIN_FAILED");
  assert.equal(Number((await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId)).sessions), 1);
  const deletion = await api(server!, deletionJar, "/api/auth/delete-user", { body: { password: PASSWORD_NEW } });
  expectStatus(deletion, 200, "ACCOUNT_DELETION_FAILED");
  expectStatus(await api(server!, deletionJar, "/api/auth/session"), 401, "SESSION_SURVIVED_ACCOUNT_DELETION");
  const deleted = await authSnapshot(fixture.email, fixture.inviteId, fixture.challengeId);
  assertNoAccountFootprint(deleted, "ACCOUNT_DELETION");
  // The user-delete trigger intentionally removes the user's invite and its
  // email-verification row; this is the current account-deletion policy.
  assert.equal(deleted.invite_status, null, "ACCOUNT_DELETION_LEFT_LINKED_INVITE");
  assert.equal(deleted.proof_verified, null, "ACCOUNT_DELETION_LEFT_LINKED_EMAIL_PROOF");
  assert.equal(deleted.proof_consumed, null, "ACCOUNT_DELETION_LEFT_LINKED_EMAIL_PROOF");
  assert.equal(deleted.proof_invalidated, null, "ACCOUNT_DELETION_LEFT_LINKED_EMAIL_PROOF");
  writeCase("account_deletion_cascades_local_user_owned_data");
}

async function cleanup(): Promise<void> {
  if (server) {
    await server.stop();
    server = null;
  }
  const cleanupErrors: string[] = [];
  if (pool && activePrefix) {
    for (const [name, statement, values] of [
      ["synthetic_users", "DELETE FROM users WHERE email LIKE $1", [`${activePrefix}%`]],
      ["synthetic_invites", "DELETE FROM alpha_invites WHERE email_normalized LIKE $1", [`${activePrefix}%`]],
      ...(rateLimitBaselineVerified ? [["synthetic_rate_limits", "DELETE FROM rate_limits", []] as const] : []),
    ] as const) {
      try {
        await query(statement, [...values]);
        console.info(JSON.stringify({ event: "auth.postgres.cleanup", fixture: name, outcome: "PASS" }));
      } catch (error) {
        const code = safeCode(error);
        cleanupErrors.push(`${name}:${code}`);
        console.error(JSON.stringify({ event: "auth.postgres.cleanup", fixture: name, outcome: "FAIL", error_code: code }));
      }
    }
    if (rateLimitBaselineVerified) {
      try {
        const [remaining] = await query<{ count: number }>("SELECT count(*)::int AS count FROM rate_limits");
        assert.equal(Number(remaining?.count), 0, "AUTH_E2E_RATE_LIMIT_FIXTURE_REMAINS");
        console.info(JSON.stringify({ event: "auth.postgres.cleanup", fixture: "rate_limits_zero", outcome: "PASS" }));
      } catch (error) {
        const code = safeCode(error);
        cleanupErrors.push(`rate_limits_zero:${code}`);
        console.error(JSON.stringify({ event: "auth.postgres.cleanup", fixture: "rate_limits_zero", outcome: "FAIL", error_code: code }));
      }
    }
  }
  if (pool) {
    const closing = pool;
    pool = null;
    await Promise.race([
      closing.end(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DATABASE_POOL_CLOSE_TIMEOUT")), 5_000)),
    ]).catch(() => undefined);
  }
  if (cleanupErrors.length > 0) {
    throw Object.assign(new Error("AUTH_E2E_CLEANUP_FAILED"), { code: "AUTH_E2E_CLEANUP_FAILED" });
  }
}

async function main(): Promise<void> {
  const scenario = process.argv[2] as AuthScenario | undefined;
  if (!scenario || !AUTH_SCENARIOS.includes(scenario)) {
    throw Object.assign(new Error("AUTH_E2E_SCENARIO_REQUIRED"), { code: "AUTH_E2E_SCENARIO_REQUIRED" });
  }

  const timeout = setTimeout(() => {
    console.error(JSON.stringify({ event: "auth.postgres.e2e", case: stage, outcome: "FAIL", error_code: "AUTH_E2E_HARD_TIMEOUT" }));
    server?.child.kill("SIGKILL");
    process.exitCode = 2;
  }, SUITE_TIMEOUT_MS);
  timeout.unref();

  const databaseUrl = mustEnv("TEST_DATABASE_URL");
  assertSafeTarget(databaseUrl);
  neonConfig.poolQueryViaFetch = true;
  pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
    statement_timeout: 15_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 20_000,
  });
  activePrefix = `rc-auth-${randomBytes(5).toString("hex")}-`;
  activeRateLimitIp = `198.51.100.${1 + (randomBytes(1)[0]! % 254)}`;

  try {
    stage = "fresh_database_baseline";
    await testPreAuthBaseline();
    stage = "next_server_start";
    server = await startServer();
    if (scenario === "didit-security") {
      stage = "didit_security";
      await testDiditSecurity();
    } else if (scenario === "proofs") {
      stage = "invalid_proof_matrix";
      await testInvalidProofs(server);
    } else if (scenario === "registration") {
      stage = "normal_registration";
      await testNormalRegistrationAndExistingAccount();
    } else if (scenario.startsWith("compensation-")) {
      stage = `${scenario}_compensation`;
      const injection = scenario.slice("compensation-".length) as "consume" | "finalize" | "profile";
      await testFailureCompensation(injection);
    } else if (scenario === "profile-visibility") {
      stage = "normal_registration";
      const { fixture, jar } = await testNormalRegistrationAndExistingAccount();
      stage = "profile_and_visibility";
      await testProfileOnboardingAndPrivacy(fixture, jar);
    } else if (scenario === "support-lifecycle") {
      const { fixture, jar } = await testNormalRegistrationAndExistingAccount();
      stage = "support_lifecycle";
      await testSupportLifecycle(fixture, jar);
    } else if (scenario === "password-reset-delete") {
      stage = "normal_registration";
      const { fixture, jar } = await testNormalRegistrationAndExistingAccount();
      stage = "password_reset_logout_delete";
      await testPasswordResetLogoutAndDeletion(fixture, jar);
    } else if (scenario === "invite-replay") {
      stage = "normal_registration";
      const { fixture } = await testNormalRegistrationAndExistingAccount();
      stage = "invite_replay";
      const reused = await api(server!, new Map(), "/api/alpha/invite/prepare", {
        body: { capability: fixture.rawCode },
      });
      expectStatus(reused, 403, "CONSUMED_INVITE_REUSED");
      writeCase("consumed_invite_cannot_be_reused");
    }
  } finally {
    clearTimeout(timeout);
    await cleanup();
  }
  console.info(JSON.stringify({ event: "auth.postgres.e2e", outcome: "PASS", evidence: "sanitized_count_only" }));
}

main().catch(async (error: unknown) => {
  const details = error as { assertionCode?: unknown; actualStatus?: unknown; expectedStatus?: unknown; responseError?: unknown };
  const rawMessage = error instanceof Error ? error.message : "";
  const parsedAssertionCode = /^([A-Z0-9_]{2,64})(?:\s|$)/u.exec(rawMessage)?.[1];
  const assertionCode = typeof details?.assertionCode === "string" && /^[A-Z0-9_]{2,64}$/u.test(details.assertionCode)
    ? details.assertionCode
    : parsedAssertionCode;
  const statusDetails = Number.isInteger(details?.actualStatus)
    ? { actual_status: details.actualStatus, expected_status: Number.isInteger(details.expectedStatus) ? details.expectedStatus : undefined }
    : {};
  const responseError = typeof details?.responseError === "string" && /^[A-Za-z ]{1,80}$/u.test(details.responseError)
    ? details.responseError
    : undefined;
  console.error(JSON.stringify({ event: "auth.postgres.e2e", case: stage, outcome: "FAIL", error_code: safeCode(error), assertion: assertionCode, response_error: responseError, ...statusDetails }));
  if (server?.getDiagnostics().length) {
    console.error(JSON.stringify({ event: "auth.postgres.e2e", case: stage, diagnostic: server.getDiagnostics() }));
  }
  await cleanup();
  process.exitCode = 1;
});
