/**
 * Staging-only RLS adversarial smoke (anon/publishable key + user JWTs).
 * Does NOT use SUPABASE_SERVICE_ROLE_KEY.
 *
 * Required env (local only — never commit values):
 *   STAGING_SUPABASE_URL          — Unstandard-staging project URL
 *   STAGING_SUPABASE_ANON_KEY     — publishable/anon key (not service role)
 *   USER_A_JWT                    — User A access_token
 *   USER_B_JWT                    — User B access_token
 *   STAGING_APP_URL               — explicit Vercel Preview origin (required)
 *
 * Optional env:
 *   TEST_QUESTION_ID              — default onboarding seed UUID
 *   USER_A_SESSION_COOKIE         — cookie header for authenticated /api/auth/session
 *
 * Env name map (runbook ↔ script):
 *   STAGING_SUPABASE_URL       ≈ UNSTANDARD_SUPABASE_URL (Vercel) / SUPABASE_URL (curl samples)
 *   STAGING_SUPABASE_ANON_KEY  ≈ UNSTANDARD_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY
 *   USER_A_JWT / USER_B_JWT    ≈ USER_A_TOKEN / USER_B_TOKEN
 *   STAGING_APP_URL            = Preview host only (no Production default)
 */

import { createClient, type SupabaseClient, type PostgrestError } from "@supabase/supabase-js";

type TestResult = "PASS" | "FAIL" | "SKIP" | "INCOMPLETE" | "MANUAL";

const DEFAULT_QUESTION_ID = "22222222-2222-2222-2222-222222222222";
/** Historical P0-5 Production host — invalid for PR #30 Preview app checks. */
const REJECTED_PRODUCTION_APP_HOSTS = new Set([
  "unstandard-m9qj.vercel.app",
  "www.unstandard-m9qj.vercel.app",
]);

const results: { name: string; result: TestResult; detail: string }[] = [];
const createdRowIds: { table: string; id: string }[] = [];

/** Required cases — SKIP/MANUAL/INCOMPLETE on these makes the run non-PASS. */
const REQUIRED_CASES = new Set([
  "0-distinct-users",
  "1-user-a-profile",
  "1b-user-b-profile",
  "2a-user-a-cross-target-insert-denied",
  "2b-user-a-answer",
  "2c-user-b-answer",
  "3a-user-a-read-user-b-answer",
  "3b-user-b-read-user-a-answer",
  "4-user-b-update-user-a-answer",
  "4b-user-a-update-retarget-denied",
  "5-user-b-insert-depth-eval-for-user-a",
  "6-anonymous-insert-blocked-by-rls",
  "7-duplicate-answer-deterministic",
  "8a-session-api-unauthenticated",
  "8b-session-api-authenticated-safe-fields",
  "9-protected-route-redirect",
]);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

function redactId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 8)}...`;
}

function decodeJwtSub(jwt: string): string {
  const parts = jwt.split(".");
  if (parts.length < 2) {
    throw new Error("invalid JWT shape");
  }
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    sub?: string;
  };
  if (!payload.sub) {
    throw new Error("JWT missing sub claim");
  }
  return payload.sub;
}

function record(name: string, result: TestResult, detail: string): void {
  results.push({ name, result, detail });
  console.log(`[${result}] ${name} — ${detail}`);
}

/**
 * Only PostgreSQL 42501 or explicit permission-denied text counts as RLS denial.
 * 23503 (FK), 23505 (unique), validation, and other DB errors must never count as RLS PASS.
 */
function isRlsDenial(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === "42501") return true;
  const message = (error.message ?? "").toLowerCase();
  const details = (error.details ?? "").toLowerCase();
  const hint = (error.hint ?? "").toLowerCase();
  const combined = `${message} ${details} ${hint}`;
  return (
    combined.includes("row-level security") ||
    combined.includes("row level security") ||
    combined.includes("permission denied") ||
    combined.includes("violates row-level security policy") ||
    combined.includes("new row violates row-level security")
  );
}

function describeError(error: PostgrestError): string {
  const code = error.code ?? "unknown";
  if (code === "23503") return "23503 FK/referential (not RLS proof)";
  if (code === "23505") return "23505 unique violation (not RLS proof)";
  if (code === "42501") return "42501 RLS/permission denied";
  return `${code}`;
}

function resolvePreviewAppUrl(): string {
  const raw = process.env.STAGING_APP_URL?.trim();
  if (!raw) {
    throw new Error(
      "missing required env: STAGING_APP_URL (explicit Vercel Preview origin; no Production default)",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("STAGING_APP_URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("STAGING_APP_URL must be https");
  }
  const host = parsed.hostname.toLowerCase();
  if (REJECTED_PRODUCTION_APP_HOSTS.has(host)) {
    throw new Error(
      `STAGING_APP_URL rejects historical Production host (${host}); use the PR Preview deployment origin`,
    );
  }
  return `${parsed.origin}`;
}

function createAuthedClient(url: string, anonKey: string, jwt: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function createAnonClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureOwnProfile(
  client: SupabaseClient,
  userId: string,
  caseName: string,
): Promise<boolean> {
  const nickname = `rls-smoke-${caseName}-${Date.now()}`;
  const { data: existing, error: selectError } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    record(caseName, "FAIL", `select failed: ${describeError(selectError)}`);
    return false;
  }

  if (existing) {
    const { error: updateError } = await client
      .from("profiles")
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) {
      record(caseName, "FAIL", `update failed: ${describeError(updateError)}`);
      return false;
    }
    record(caseName, "PASS", `updated own profile (${redactId(userId)})`);
    return true;
  }

  const { error: insertError } = await client.from("profiles").insert({
    id: userId,
    nickname,
  });
  if (insertError) {
    record(caseName, "FAIL", `insert failed: ${describeError(insertError)}`);
    return false;
  }
  createdRowIds.push({ table: "profiles", id: userId });
  record(caseName, "PASS", `inserted own profile (${redactId(userId)})`);
  return true;
}

/**
 * Cross-target insert MUST run before User A's own answer on the same question,
 * so a uniqueness violation cannot mask the RLS denial.
 */
async function testCrossTargetInsertDenied(
  client: SupabaseClient,
  userAId: string,
  userBId: string,
  questionId: string,
): Promise<void> {
  const { data, error } = await client
    .from("answers")
    .insert({
      user_id: userAId,
      question_id: questionId,
      target_profile_id: userBId,
      answer_text: "cross-target insert must be denied by RLS policy.",
    })
    .select("id")
    .single();

  if (!error && data) {
    createdRowIds.push({ table: "answers", id: data.id as string });
    record(
      "2a-user-a-cross-target-insert-denied",
      "FAIL",
      "User A inserted answer targeting User B profile (RLS bypass)",
    );
    return;
  }

  if (isRlsDenial(error)) {
    record(
      "2a-user-a-cross-target-insert-denied",
      "PASS",
      `cross-target insert denied by RLS (${describeError(error!)})`,
    );
    return;
  }

  record(
    "2a-user-a-cross-target-insert-denied",
    "FAIL",
    `expected RLS denial (42501); got ${error ? describeError(error) : "no error"} — FK/unique must not count as PASS`,
  );
}

async function testOwnAnswerInsert(
  client: SupabaseClient,
  userId: string,
  questionId: string,
  caseName: string,
): Promise<string | null> {
  const answerText = `rls-smoke answer ${Date.now()} — at least twenty chars here.`;

  const { data, error } = await client
    .from("answers")
    .insert({
      user_id: userId,
      question_id: questionId,
      target_profile_id: userId,
      answer_text: answerText,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: lookupError } = await client
        .from("answers")
        .select("id")
        .eq("user_id", userId)
        .eq("question_id", questionId)
        .maybeSingle();
      if (lookupError || !existing) {
        record(caseName, "FAIL", "duplicate without readable own row");
        return null;
      }
      record(caseName, "PASS", `reused existing answer (${redactId(existing.id as string)})`);
      return existing.id as string;
    }
    record(caseName, "FAIL", `insert failed: ${describeError(error)}`);
    return null;
  }

  const answerId = data.id as string;
  createdRowIds.push({ table: "answers", id: answerId });
  record(caseName, "PASS", `inserted own answer (${redactId(answerId)})`);
  return answerId;
}

async function testCannotReadOtherUserAnswers(
  client: SupabaseClient,
  otherUserId: string,
  otherAnswerId: string,
  caseName: string,
): Promise<void> {
  const { data, error } = await client
    .from("answers")
    .select("id, user_id, answer_text")
    .eq("user_id", otherUserId);

  if (error) {
    if (isRlsDenial(error)) {
      record(caseName, "PASS", "read blocked by RLS (42501/permission)");
      return;
    }
    record(caseName, "FAIL", `unexpected error (not RLS proof): ${describeError(error)}`);
    return;
  }

  const leaked = (data ?? []).some((row) => row.id === otherAnswerId || row.user_id === otherUserId);
  if (leaked) {
    record(caseName, "FAIL", "other user's answer row visible");
    return;
  }
  record(caseName, "PASS", "no other-user rows visible (empty under RLS)");
}

async function testUserBUpdatesUserAAnswer(
  client: SupabaseClient,
  answerId: string,
): Promise<void> {
  const { data, error } = await client
    .from("answers")
    .update({ answer_text: "hostile update attempt with enough length." })
    .eq("id", answerId)
    .select("id");

  if (error) {
    if (isRlsDenial(error)) {
      record("4-user-b-update-user-a-answer", "PASS", "update blocked by RLS");
      return;
    }
    record(
      "4-user-b-update-user-a-answer",
      "FAIL",
      `unexpected error (not RLS proof): ${describeError(error)}`,
    );
    return;
  }

  if (!data || data.length === 0) {
    // Row invisible under SELECT/USING — acceptable RLS outcome for UPDATE.
    record("4-user-b-update-user-a-answer", "PASS", "update affected 0 rows (not visible under RLS)");
    return;
  }
  record("4-user-b-update-user-a-answer", "FAIL", "User B updated User A answer");
}

/**
 * MERGE BLOCKER if this passes without migration 0006:
 * answers_update_own must not allow changing target_profile_id to another user.
 */
async function testUserACannotRetargetOwnAnswer(
  client: SupabaseClient,
  answerId: string,
  userBId: string,
): Promise<void> {
  const { data, error } = await client
    .from("answers")
    .update({ target_profile_id: userBId })
    .eq("id", answerId)
    .select("id, target_profile_id");

  if (error) {
    if (isRlsDenial(error)) {
      record(
        "4b-user-a-update-retarget-denied",
        "PASS",
        "retarget UPDATE blocked by RLS WITH CHECK",
      );
      return;
    }
    record(
      "4b-user-a-update-retarget-denied",
      "FAIL",
      `unexpected error (not RLS proof): ${describeError(error)}`,
    );
    return;
  }

  const retargeted = (data ?? []).some((row) => row.target_profile_id === userBId);
  if (retargeted) {
    record(
      "4b-user-a-update-retarget-denied",
      "FAIL",
      "MERGE BLOCKER: answers UPDATE allowed target_profile_id change to another user — apply 0006",
    );
    return;
  }

  if (!data || data.length === 0) {
    record(
      "4b-user-a-update-retarget-denied",
      "INCOMPLETE",
      "update returned 0 rows — cannot confirm WITH CHECK invariant",
    );
    return;
  }

  record(
    "4b-user-a-update-retarget-denied",
    "PASS",
    "retarget did not persist (target unchanged)",
  );
}

async function testUserBInsertsDepthEvalForUserA(
  client: SupabaseClient,
  userBId: string,
  answerId: string,
): Promise<void> {
  const { error } = await client.from("depth_evaluations").insert({
    answer_id: answerId,
    user_id: userBId,
    verdict: "PASS",
    score: 0.9,
    path: "smoke",
    reason_codes: ["smoke"],
    model_version: "rls-smoke",
  });

  if (!error) {
    record(
      "5-user-b-insert-depth-eval-for-user-a",
      "FAIL",
      "User B inserted depth_evaluation for User A answer",
    );
    return;
  }

  if (isRlsDenial(error)) {
    record(
      "5-user-b-insert-depth-eval-for-user-a",
      "PASS",
      `insert blocked by RLS (${describeError(error)})`,
    );
    return;
  }

  record(
    "5-user-b-insert-depth-eval-for-user-a",
    "FAIL",
    `expected RLS denial; got ${describeError(error)} — FK/unique must not count as PASS`,
  );
}

/**
 * Anonymous inserts must fail RLS even when FK targets exist (User A profile).
 * 23503 alone is NOT proof of RLS.
 */
async function testAnonymousInsertsBlockedByRls(
  url: string,
  anonKey: string,
  questionId: string,
  existingUserId: string,
): Promise<void> {
  const anon = createAnonClient(url, anonKey);

  const profileResult = await anon.from("profiles").insert({
    id: existingUserId,
    nickname: "anon-should-fail-rls",
  });

  const answerResult = await anon.from("answers").insert({
    user_id: existingUserId,
    question_id: questionId,
    target_profile_id: existingUserId,
    answer_text: "anonymous insert should never succeed here.",
  });

  const profileError = profileResult.error;
  const answerError = answerResult.error;

  const profileRls = isRlsDenial(profileError);
  const answerRls = isRlsDenial(answerError);

  if (profileRls && answerRls) {
    record(
      "6-anonymous-insert-blocked-by-rls",
      "PASS",
      "anonymous profile and answer inserts denied by RLS (FK-satisfying ids)",
    );
    return;
  }

  if (!profileError || !answerError) {
    record(
      "6-anonymous-insert-blocked-by-rls",
      "FAIL",
      `anonymous insert succeeded (profileError=${profileError == null} answerError=${answerError == null})`,
    );
    return;
  }

  record(
    "6-anonymous-insert-blocked-by-rls",
    "FAIL",
    `RLS not proven — profile=${describeError(profileError)} answer=${describeError(answerError)}`,
  );
}

async function testDuplicateAnswerDeterministic(
  client: SupabaseClient,
  userId: string,
  questionId: string,
): Promise<void> {
  const { error } = await client.from("answers").insert({
    user_id: userId,
    question_id: questionId,
    target_profile_id: userId,
    answer_text: "duplicate attempt with sufficient answer length here.",
  });

  if (!error) {
    record("7-duplicate-answer-deterministic", "FAIL", "duplicate insert succeeded unexpectedly");
    return;
  }

  if (error.code === "23505") {
    record("7-duplicate-answer-deterministic", "PASS", "duplicate rejected with unique violation 23505");
    return;
  }

  if (isRlsDenial(error)) {
    record(
      "7-duplicate-answer-deterministic",
      "FAIL",
      "got RLS denial instead of 23505 — unique index path not verified",
    );
    return;
  }

  record(
    "7-duplicate-answer-deterministic",
    "FAIL",
    `expected 23505, got ${describeError(error)}`,
  );
}

async function testSessionApiUnauthenticated(appUrl: string): Promise<void> {
  const response = await fetch(`${appUrl}/api/auth/session`, {
    method: "GET",
    redirect: "manual",
  });

  if (response.status !== 401) {
    record(
      "8a-session-api-unauthenticated",
      "FAIL",
      `unauthenticated session expected 401, got ${response.status}`,
    );
    return;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    record("8a-session-api-unauthenticated", "FAIL", "session response is not JSON");
    return;
  }

  const user = (body as { user?: unknown }).user;
  if (user !== null) {
    record("8a-session-api-unauthenticated", "FAIL", "unauthenticated session user is not null");
    return;
  }

  record("8a-session-api-unauthenticated", "PASS", "unauthenticated 401 with user:null");
}

async function testSessionApiAuthenticatedSafeFields(appUrl: string): Promise<void> {
  const cookie = process.env.USER_A_SESSION_COOKIE?.trim();
  if (!cookie) {
    record(
      "8b-session-api-authenticated-safe-fields",
      "MANUAL",
      "set USER_A_SESSION_COOKIE locally to verify authenticated keys (nickname, onboarded, idPrefix only)",
    );
    return;
  }

  const response = await fetch(`${appUrl}/api/auth/session`, {
    method: "GET",
    redirect: "manual",
    headers: { Cookie: cookie },
  });

  if (response.status !== 200) {
    record(
      "8b-session-api-authenticated-safe-fields",
      "FAIL",
      `authenticated session expected 200, got ${response.status}`,
    );
    return;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    record("8b-session-api-authenticated-safe-fields", "FAIL", "session response is not JSON");
    return;
  }

  const user = (body as { user?: Record<string, unknown> | null }).user;
  if (!user || typeof user !== "object") {
    record("8b-session-api-authenticated-safe-fields", "FAIL", "authenticated session missing user object");
    return;
  }

  const allowedKeys = ["nickname", "onboarded", "idPrefix"] as const;
  const allowedKeySet = new Set<string>(allowedKeys);
  const actualKeys = Object.keys(user);
  const unexpected = actualKeys.filter((key) => !allowedKeySet.has(key));
  const forbiddenPresent = ["email", "id", "token", "access_token", "refresh_token", "phone"].filter(
    (key) => key in user,
  );

  if (unexpected.length > 0 || forbiddenPresent.length > 0) {
    record(
      "8b-session-api-authenticated-safe-fields",
      "FAIL",
      `unsafe or unexpected keys: ${[...unexpected, ...forbiddenPresent].join(", ") || "(none)"}`,
    );
    return;
  }

  for (const key of allowedKeys) {
    if (!(key in user)) {
      record(
        "8b-session-api-authenticated-safe-fields",
        "FAIL",
        `missing required safe field: ${key}`,
      );
      return;
    }
  }

  record(
    "8b-session-api-authenticated-safe-fields",
    "PASS",
    "authenticated session contains only nickname, onboarded, idPrefix",
  );
}

async function testProtectedRouteRedirect(appUrl: string): Promise<void> {
  const response = await fetch(`${appUrl}/app/home`, {
    method: "GET",
    redirect: "manual",
  });

  const location = response.headers.get("location") ?? "";
  const redirectsToLogin =
    (response.status === 307 || response.status === 302 || response.status === 303) &&
    location.includes("/login");

  if (redirectsToLogin) {
    record("9-protected-route-redirect", "PASS", `unauthenticated /app/home -> ${response.status} /login`);
    return;
  }

  record(
    "9-protected-route-redirect",
    "FAIL",
    `expected redirect to /login, status=${response.status}, location=${location || "(none)"}`,
  );
}

function printSummaryAndExit(): void {
  const failed = results.filter((r) => r.result === "FAIL");
  const skipped = results.filter((r) => r.result === "SKIP");
  const incomplete = results.filter((r) => r.result === "INCOMPLETE");
  const manual = results.filter((r) => r.result === "MANUAL");

  const requiredIncomplete = results.filter(
    (r) =>
      REQUIRED_CASES.has(r.name) &&
      (r.result === "SKIP" || r.result === "INCOMPLETE" || r.result === "MANUAL"),
  );

  console.log("\n--- summary ---");
  for (const row of results) {
    console.log(`${row.result.padEnd(10)} ${row.name}`);
  }

  if (createdRowIds.length > 0) {
    console.log("\n--- created test rows (no service-role cleanup) ---");
    for (const row of createdRowIds) {
      console.log(`${row.table}: ${redactId(row.id)}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSKIP count: ${skipped.length}`);
  }
  if (incomplete.length > 0) {
    console.log(`INCOMPLETE count: ${incomplete.length}`);
  }
  if (manual.length > 0) {
    console.log(`MANUAL count: ${manual.length} (required MANUAL => non-PASS until verified)`);
  }

  if (failed.length > 0) {
    console.error(`\nRLS adversarial smoke FAILED (${failed.length} required defect(s))`);
    process.exit(1);
  }

  if (requiredIncomplete.length > 0) {
    console.error(
      `\nRLS adversarial smoke INCOMPLETE (${requiredIncomplete.length} required case(s) SKIP/MANUAL/INCOMPLETE) — not PASSED`,
    );
    process.exit(1);
  }

  console.log("\nRLS adversarial smoke PASSED");
}

async function main(): Promise<void> {
  const url = requireEnv("STAGING_SUPABASE_URL");
  const anonKey = requireEnv("STAGING_SUPABASE_ANON_KEY");
  const userAJwt = requireEnv("USER_A_JWT");
  const userBJwt = requireEnv("USER_B_JWT");
  const questionId = process.env.TEST_QUESTION_ID?.trim() || DEFAULT_QUESTION_ID;
  const appUrl = resolvePreviewAppUrl();

  console.log("RLS adversarial smoke — staging only");
  console.log(`Preview app URL host: ${new URL(appUrl).hostname}`);
  console.log("Supabase URL/project: verify manually is Unstandard-staging (value not printed)");
  console.log("Service role key: not used");

  let userAId: string;
  let userBId: string;
  try {
    userAId = decodeJwtSub(userAJwt);
    userBId = decodeJwtSub(userBJwt);
  } catch (error) {
    console.error(`[FAIL] jwt-decode — ${error instanceof Error ? error.message : "invalid JWT"}`);
    process.exit(1);
  }

  if (userAId === userBId) {
    record("0-distinct-users", "FAIL", "USER_A_JWT and USER_B_JWT resolve to same sub");
    printSummaryAndExit();
    return;
  }
  record("0-distinct-users", "PASS", `User A ${redactId(userAId)} / User B ${redactId(userBId)}`);

  const clientA = createAuthedClient(url, anonKey, userAJwt);
  const clientB = createAuthedClient(url, anonKey, userBJwt);

  const profileAOk = await ensureOwnProfile(clientA, userAId, "1-user-a-profile");
  const profileBOk = await ensureOwnProfile(clientB, userBId, "1b-user-b-profile");

  if (!profileAOk || !profileBOk) {
    record("2a-user-a-cross-target-insert-denied", "SKIP", "profiles not ready");
    record("2b-user-a-answer", "SKIP", "profiles not ready");
    record("2c-user-b-answer", "SKIP", "profiles not ready");
    record("3a-user-a-read-user-b-answer", "SKIP", "profiles not ready");
    record("3b-user-b-read-user-a-answer", "SKIP", "profiles not ready");
    record("4-user-b-update-user-a-answer", "SKIP", "profiles not ready");
    record("4b-user-a-update-retarget-denied", "SKIP", "profiles not ready");
    record("5-user-b-insert-depth-eval-for-user-a", "SKIP", "profiles not ready");
    record("6-anonymous-insert-blocked-by-rls", "SKIP", "profiles not ready");
    record("7-duplicate-answer-deterministic", "SKIP", "profiles not ready");
  } else {
    // Cross-target BEFORE own answer so 23505 cannot mask RLS denial.
    await testCrossTargetInsertDenied(clientA, userAId, userBId, questionId);

    const answerAId = await testOwnAnswerInsert(clientA, userAId, questionId, "2b-user-a-answer");
    const answerBId = await testOwnAnswerInsert(clientB, userBId, questionId, "2c-user-b-answer");

    if (answerBId) {
      await testCannotReadOtherUserAnswers(clientA, userBId, answerBId, "3a-user-a-read-user-b-answer");
    } else {
      record("3a-user-a-read-user-b-answer", "SKIP", "no User B answer id");
    }

    if (answerAId) {
      await testCannotReadOtherUserAnswers(clientB, userAId, answerAId, "3b-user-b-read-user-a-answer");
      await testUserBUpdatesUserAAnswer(clientB, answerAId);
      await testUserACannotRetargetOwnAnswer(clientA, answerAId, userBId);
      await testUserBInsertsDepthEvalForUserA(clientB, userBId, answerAId);
      await testDuplicateAnswerDeterministic(clientA, userAId, questionId);
    } else {
      record("3b-user-b-read-user-a-answer", "SKIP", "no User A answer id");
      record("4-user-b-update-user-a-answer", "SKIP", "no User A answer id");
      record("4b-user-a-update-retarget-denied", "SKIP", "no User A answer id");
      record("5-user-b-insert-depth-eval-for-user-a", "SKIP", "no User A answer id");
      record("7-duplicate-answer-deterministic", "SKIP", "no User A answer id");
    }

    await testAnonymousInsertsBlockedByRls(url, anonKey, questionId, userAId);
  }

  await testSessionApiUnauthenticated(appUrl);
  await testSessionApiAuthenticatedSafeFields(appUrl);
  await testProtectedRouteRedirect(appUrl);

  printSummaryAndExit();
}

main().catch((error) => {
  console.error(`[FAIL] fatal — ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
