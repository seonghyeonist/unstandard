/**
 * Staging-only RLS adversarial smoke (anon/publishable key + user JWTs).
 * Does NOT use SUPABASE_SERVICE_ROLE_KEY.
 *
 * Required env:
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY
 *   USER_A_JWT
 *   USER_B_JWT
 *   TEST_QUESTION_ID (default: 22222222-2222-2222-2222-222222222222)
 *
 * Optional env:
 *   STAGING_APP_URL (default: https://unstandard-m9qj.vercel.app) — app route checks only
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestResult = "PASS" | "FAIL" | "SKIP";

const DEFAULT_QUESTION_ID = "22222222-2222-2222-2222-222222222222";
const DEFAULT_APP_URL = "https://unstandard-m9qj.vercel.app";

const results: { name: string; result: TestResult; detail: string }[] = [];
const createdRowIds: { table: string; id: string }[] = [];

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

async function testUserAProfile(client: SupabaseClient, userId: string): Promise<void> {
  const nickname = `rls-smoke-${Date.now()}`;
  const { data: existing, error: selectError } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    record("1-user-a-profile", "FAIL", `select failed: ${selectError.code ?? "unknown"}`);
    return;
  }

  if (existing) {
    const { error: updateError } = await client
      .from("profiles")
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) {
      record("1-user-a-profile", "FAIL", `update failed: ${updateError.code ?? "unknown"}`);
      return;
    }
    record("1-user-a-profile", "PASS", `updated own profile (${redactId(userId)})`);
    return;
  }

  const { error: insertError } = await client.from("profiles").insert({
    id: userId,
    nickname,
  });
  if (insertError) {
    record("1-user-a-profile", "FAIL", `insert failed: ${insertError.code ?? "unknown"}`);
    return;
  }
  createdRowIds.push({ table: "profiles", id: userId });
  record("1-user-a-profile", "PASS", `inserted own profile (${redactId(userId)})`);
}

async function testUserAAnswer(
  client: SupabaseClient,
  userId: string,
  questionId: string,
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
        record("2-user-a-answer", "FAIL", "duplicate without readable own row");
        return null;
      }
      record("2-user-a-answer", "PASS", `reused existing answer (${redactId(existing.id as string)})`);
      return existing.id as string;
    }
    record("2-user-a-answer", "FAIL", `insert failed: ${error.code ?? "unknown"}`);
    return null;
  }

  const answerId = data.id as string;
  createdRowIds.push({ table: "answers", id: answerId });
  record("2-user-a-answer", "PASS", `inserted own answer (${redactId(answerId)})`);
  return answerId;
}

async function testUserBReadsUserAAnswer(
  client: SupabaseClient,
  userAId: string,
  answerId: string,
): Promise<void> {
  const { data, error } = await client
    .from("answers")
    .select("id, user_id, answer_text")
    .eq("user_id", userAId);

  if (error) {
    const blocked = error.code === "42501" || error.message.toLowerCase().includes("permission");
    record(
      "3-user-b-read-user-a-answer",
      blocked ? "PASS" : "FAIL",
      blocked ? "read blocked by RLS" : `unexpected error: ${error.code ?? "unknown"}`,
    );
    return;
  }

  const leaked = (data ?? []).some((row) => row.id === answerId);
  if (leaked) {
    record("3-user-b-read-user-a-answer", "FAIL", "User B could read User A answer row");
    return;
  }
  record("3-user-b-read-user-a-answer", "PASS", "no User A rows visible to User B");
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
    const blocked = error.code === "42501" || error.message.toLowerCase().includes("permission");
    record(
      "4-user-b-update-user-a-answer",
      blocked ? "PASS" : "FAIL",
      blocked ? "update blocked by RLS" : `unexpected error: ${error.code ?? "unknown"}`,
    );
    return;
  }

  if (!data || data.length === 0) {
    record("4-user-b-update-user-a-answer", "PASS", "update affected 0 rows");
    return;
  }
  record("4-user-b-update-user-a-answer", "FAIL", "User B updated User A answer");
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

  if (error) {
    const blocked =
      error.code === "42501" ||
      error.code === "23503" ||
      error.message.toLowerCase().includes("permission");
    record(
      "5-user-b-insert-depth-eval-for-user-a",
      blocked ? "PASS" : "FAIL",
      blocked ? `insert blocked (${error.code ?? "rls"})` : `unexpected: ${error.code ?? "unknown"}`,
    );
    return;
  }
  record("5-user-b-insert-depth-eval-for-user-a", "FAIL", "User B inserted depth_evaluation for User A answer");
}

async function testAnonymousInserts(url: string, anonKey: string, questionId: string): Promise<void> {
  const anon = createAnonClient(url, anonKey);
  const fakeUserId = "00000000-0000-4000-8000-000000000001";

  const profileResult = await anon.from("profiles").insert({
    id: fakeUserId,
    nickname: "anon-should-fail",
  });

  const answerResult = await anon.from("answers").insert({
    user_id: fakeUserId,
    question_id: questionId,
    target_profile_id: fakeUserId,
    answer_text: "anonymous insert should never succeed here.",
  });

  const profileError = profileResult.error;
  const answerError = answerResult.error;

  const profileBlocked =
    profileError !== null &&
    (profileError.code === "42501" ||
      profileError.message.toLowerCase().includes("permission") ||
      profileError.code === "23503");
  const answerBlocked =
    answerError !== null &&
    (answerError.code === "42501" ||
      answerError.message.toLowerCase().includes("permission") ||
      answerError.code === "23503");

  if (profileBlocked && answerBlocked) {
    record("6-anonymous-insert-blocked", "PASS", "anonymous profile and answer inserts blocked");
    return;
  }
  record(
    "6-anonymous-insert-blocked",
    "FAIL",
    `profileBlocked=${profileBlocked} answerBlocked=${answerBlocked}`,
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

  record(
    "7-duplicate-answer-deterministic",
    "FAIL",
    `expected 23505, got ${error.code ?? "unknown"}`,
  );
}

async function testSessionApiSafeFields(appUrl: string): Promise<void> {
  const response = await fetch(`${appUrl}/api/auth/session`, {
    method: "GET",
    redirect: "manual",
  });

  if (response.status !== 401) {
    record(
      "8-session-api-safe-fields",
      "FAIL",
      `unauthenticated session expected 401, got ${response.status}`,
    );
    return;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    record("8-session-api-safe-fields", "FAIL", "session response is not JSON");
    return;
  }

  const user = (body as { user?: unknown }).user;
  if (user !== null) {
    record("8-session-api-safe-fields", "FAIL", "unauthenticated session user is not null");
    return;
  }

  const allowedKeys = new Set(["nickname", "onboarded", "idPrefix"]);
  record(
    "8-session-api-safe-fields",
    "PASS",
    `unauthenticated 401; allowed authenticated keys documented: ${[...allowedKeys].join(", ")} (cookie session not exercised in script)`,
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

async function main(): Promise<void> {
  const url = requireEnv("STAGING_SUPABASE_URL");
  const anonKey = requireEnv("STAGING_SUPABASE_ANON_KEY");
  const userAJwt = requireEnv("USER_A_JWT");
  const userBJwt = requireEnv("USER_B_JWT");
  const questionId = process.env.TEST_QUESTION_ID?.trim() || DEFAULT_QUESTION_ID;
  const appUrl = (process.env.STAGING_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/$/, "");

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
    process.exit(1);
  }
  record("0-distinct-users", "PASS", `User A ${redactId(userAId)} / User B ${redactId(userBId)}`);

  const clientA = createAuthedClient(url, anonKey, userAJwt);
  const clientB = createAuthedClient(url, anonKey, userBJwt);

  await testUserAProfile(clientA, userAId);
  const answerId = await testUserAAnswer(clientA, userAId, questionId);

  if (answerId) {
    await testUserBReadsUserAAnswer(clientB, userAId, answerId);
    await testUserBUpdatesUserAAnswer(clientB, answerId);
    await testUserBInsertsDepthEvalForUserA(clientB, userBId, answerId);
    await testDuplicateAnswerDeterministic(clientA, userAId, questionId);
  } else {
    record("3-user-b-read-user-a-answer", "SKIP", "no User A answer id");
    record("4-user-b-update-user-a-answer", "SKIP", "no User A answer id");
    record("5-user-b-insert-depth-eval-for-user-a", "SKIP", "no User A answer id");
    record("7-duplicate-answer-deterministic", "SKIP", "no User A answer id");
  }

  await testAnonymousInserts(url, anonKey, questionId);
  await testSessionApiSafeFields(appUrl);
  await testProtectedRouteRedirect(appUrl);

  const failed = results.filter((r) => r.result === "FAIL");
  const skipped = results.filter((r) => r.result === "SKIP");

  console.log("\n--- summary ---");
  for (const row of results) {
    console.log(`${row.result.padEnd(4)} ${row.name}`);
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

  if (failed.length > 0) {
    console.error(`\nRLS adversarial smoke FAILED (${failed.length} test(s))`);
    process.exit(1);
  }

  console.log("\nRLS adversarial smoke PASSED");
}

main().catch((error) => {
  console.error(`[FAIL] fatal — ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
