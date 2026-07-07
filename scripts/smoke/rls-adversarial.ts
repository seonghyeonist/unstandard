#!/usr/bin/env tsx
/**
 * RLS Adversarial Smoke — Unstandard staging only.
 *
 * Hard constraints:
 * - Target: Unstandard-staging only.
 * - Never production.
 * - No service role key.
 * - No adapter enabling.
 * - Read-only or bounded writes; do not mutate real user data.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface SmokeResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: SmokeResult[] = [];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  const mark = passed ? "✅" : "❌";
  console.log(`${mark} ${name}: ${detail}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`Missing env var: ${name}`);
  }
  return value;
}

async function expectError(
  name: string,
  op: () => PromiseLike<{ error: unknown }>,
  expectedMessageFragment: string
) {
  const { error } = await op();
  const message = String(error ?? "");
  const passed =
    error !== null &&
    error !== undefined &&
    (message.includes(expectedMessageFragment) ||
      message.includes("row-level security") ||
      message.includes("JWTExpired") ||
      message.includes("Unauthorized"));
  record(
    name,
    passed,
    passed ? "blocked as expected" : `unexpected: ${message || "no error"}`
  );
}

async function expectSuccess(
  name: string,
  op: () => PromiseLike<{ error: unknown; data: unknown }>
) {
  const { error, data } = await op();
  const passed = error === null || error === undefined;
  record(
    name,
    passed,
    passed
      ? `succeeded (${data === null ? "no rows" : "ok"})`
      : `failed: ${String(error)}`
  );
}

async function runAnonProbes(anon: SupabaseClient) {
  console.log("\n--- Anon / unauthenticated probes ---");

  await expectError(
    "anon: SELECT reports blocked",
    () => anon.from("reports").select("id").limit(1).single(),
    "JSON object requested, multiple (or no) rows returned"
  );

  await expectError(
    "anon: INSERT reports blocked",
    () =>
      anon
        .from("reports")
        .insert({ target_type: "profile", target_id: "smoke", reason: "smoke" })
        .select()
        .single(),
    "row-level security"
  );

  await expectError(
    "anon: SELECT profiles blocked",
    () => anon.from("profiles").select("id").limit(1).single(),
    "JSON object requested, multiple (or no) rows returned"
  );

  await expectError(
    "anon: SELECT depth_evaluations blocked",
    () => anon.from("depth_evaluations").select("id").limit(1).single(),
    "JSON object requested, multiple (or no) rows returned"
  );

  await expectSuccess(
    "anon: SELECT app_config safe subset allowed",
    () => anon.from("app_config").select("key,value").limit(1).maybeSingle()
  );
}

async function runAuthenticatedProbes(auth: SupabaseClient) {
  console.log("\n--- Authenticated user probes ---");

  const {
    data: { user },
    error: userError,
  } = await auth.auth.getUser();
  if (userError || !user) {
    record(
      "auth: session valid",
      false,
      `could not get user: ${String(userError)}`
    );
    return;
  }
  record("auth: session valid", true, `user ${user.id.slice(0, 8)}...`);

  await expectSuccess(
    "auth: SELECT own profile allowed",
    () => auth.from("profiles").select("id,nickname").eq("id", user.id).maybeSingle()
  );

  await expectSuccess(
    "auth: INSERT report for self allowed",
    () =>
      auth
        .from("reports")
        .insert({
          target_type: "profile",
          target_id: user.id,
          reason: "rls-smoke-self",
        })
        .select()
        .single()
  );

  await expectError(
    "auth: INSERT report for arbitrary target blocked",
    () =>
      auth
        .from("reports")
        .insert({
          target_type: "profile",
          target_id: "00000000-0000-0000-0000-000000000000",
          reason: "rls-smoke-other",
        })
        .select()
        .single(),
    "row-level security"
  );
}

async function main() {
  const url = requireEnv("UNSTANDARD_SUPABASE_URL");
  const key = requireEnv("UNSTANDARD_SUPABASE_PUBLISHABLE_KEY");

  if (url.includes("supabase.co") && !url.includes("-staging-")) {
    console.warn("⚠️ Supabase URL does not look like a staging project.");
  }

  const anon = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await runAnonProbes(anon);

  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;
  if (testEmail && testPassword) {
    const authClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await authClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (error) {
      record(
        "auth: sign-in with test user",
        false,
        `${String(error)} — skipping authenticated probes`
      );
    } else {
      await runAuthenticatedProbes(authClient);
    }
  } else {
    console.log(
      "\n⚠️ TEST_USER_EMAIL and TEST_USER_PASSWORD not set; skipping authenticated probes."
    );
  }

  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} probes passed`);

  if (passed !== total) {
    console.log("\n🔴 RLS smoke FAIL — do not enable adapter.");
    process.exit(1);
  }

  console.log("\n🟢 RLS smoke PASS — but adapter enabling is still a separate human decision.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
