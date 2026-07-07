/**
 * Staging-only RLS adversarial smoke (anon + publishable key + user JWTs).
 * Does NOT use SUPABASE_SERVICE_ROLE_KEY.
 *
 * Required env:
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY
 *   USER_A_JWT
 *   USER_B_JWT
 *   TEST_QUESTION_ID (default: 22222222-2222-2222-2222-222222222222)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestResult = "PASS" | "FAIL" | "SKIP";

const DEFAULT_QUESTION_ID = "22222222-2222-2222-2222-222222222222";

const results: { name: string; result: TestResult; detail: string }[] = [];

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

async function testDistinctUsers(userAId: string, userBId: string): Promise<void> {
  if (userAId === userBId) {
    record("0-distinct-users", "FAIL", "USER_A_JWT and USER_B_JWT resolve to same sub");
    process.exit(1);
  }
  record("0-distinct-users", "PASS", `User A ${redactId(userAId)} / User B ${redactId(userBId)}`);
}

async function testUserAOwnProfile(client: SupabaseClient, userId: string): Promise<void> {
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

  const { error: insertError } = await client.from("profiles").insert({ id: userId, nickname });
  if (insertError) {
    record("1-user-a-profile", "FAIL", `insert failed: ${insertError.code ?? "unknown"}`);
    return;
  }
  record("1-user-a-profile", "PASS", `inserted own profile (${redactId(userId)})`);
}

async function testUserAOwnAnswer(
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
  record("2-user-a-answer", "PASS", `inserted own answer (${redactId(answerId)})`);
  return answerId;
}

async function testUserBCannotReadUserAAnswer(
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

async function testUserBCannotUpdateUserAAnswer(client: SupabaseClient, answerId: string): Promise<void> {
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

async function testAnonymousInsertBlocked(url: string, anonKey: string, questionId: string): Promise<void> {
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

  const profileBlocked =
    profileResult.error !== null &&
    (profileResult.error.code === "42501" ||
      profileResult.error.message.toLowerCase().includes("permission") ||
      profileResult.error.code === "23503");

  const answerBlocked =
    answerResult.error !== null &&
    (answerResult.error.code === "42501" ||
      answerResult.error.message.toLowerCase().includes("permission") ||
      answerResult.error.code === "23503");

  if (profileBlocked && answerBlocked) {
    record("5-anonymous-insert-blocked", "PASS", "anonymous profile and answer inserts blocked");
    return;
  }
  record(
    "5-anonymous-insert-blocked",
    "FAIL",
    `profileBlocked=${profileBlocked} answerBlocked=${answerBlocked}`,
  );
}

async function main(): Promise<void> {
  const url = requireEnv("STAGING_SUPABASE_URL");
  const anonKey = requireEnv("STAGING_SUPABASE_ANON_KEY");
  const userAJwt = requireEnv("USER_A_JWT");
  const userBJwt = requireEnv("USER_B_JWT");
  const questionId = process.env.TEST_QUESTION_ID?.trim() || DEFAULT_QUESTION_ID;

  let userAId: string;
  let userBId: string;
  try {
    userAId = decodeJwtSub(userAJwt);
    userBId = decodeJwtSub(userBJwt);
  } catch (error) {
    console.error(`[FAIL] jwt-decode — ${error instanceof Error ? error.message : "invalid JWT"}`);
    process.exit(1);
  }

  const clientA = createAuthedClient(url, anonKey, userAJwt);
  const clientB = createAuthedClient(url, anonKey, userBJwt);

  await testDistinctUsers(userAId, userBId);
  await testUserAOwnProfile(clientA, userAId);
  const answerId = await testUserAOwnAnswer(clientA, userAId, questionId);

  if (answerId) {
    await testUserBCannotReadUserAAnswer(clientB, userAId, answerId);
    await testUserBCannotUpdateUserAAnswer(clientB, answerId);
  } else {
    record("3-user-b-read-user-a-answer", "SKIP", "no User A answer id");
    record("4-user-b-update-user-a-answer", "SKIP", "no User A answer id");
  }

  await testAnonymousInsertBlocked(url, anonKey, questionId);

  const failed = results.filter((r) => r.result === "FAIL");
  const skipped = results.filter((r) => r.result === "SKIP");

  console.log("\n--- summary ---");
  for (const row of results) {
    console.log(`${row.result.padEnd(4)} ${row.name}`);
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
