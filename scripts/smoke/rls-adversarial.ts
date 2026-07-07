#!/usr/bin/env tsx
/**
 * RLS adversarial smoke for Unstandard staging.
 *
 * Rules:
 * - Target: Unstandard-staging only.
 * - Uses Supabase publishable (anon) key only. No service role.
 * - No adapter is enabled by this script.
 * - Run after migrations are applied (`npm run db:staging:push`).
 * - Requires staging Auth to allow immediate sign-in after sign-up
 *   (disable "Enable email confirmations" in Supabase Auth → Email settings).
 *
 * The script creates two ephemeral test users, exercises own vs cross-user
 * access, and deletes the data rows it inserted. Auth users are left in
 * auth.users because deletion requires service role; clean them up manually
 * from the Supabase dashboard if desired.
 */

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabaseConfig } from "../../lib/config/supabase-config";

type SmokeResult = {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail?: string;
};

const results: SmokeResult[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, status: ok ? "PASS" : "FAIL", detail });
}

function fail(message: string): never {
  console.error(`\n❌ STOP: ${message}`);
  process.exit(1);
}

async function getOrCreateUser(
  supabase: SupabaseClient,
  label: string,
  email: string,
  password: string,
): Promise<{ user: User; sessionToken: string }> {
  // Prefer existing account to keep the script idempotent across reruns.
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInData.session) {
    return {
      user: signInData.user!,
      sessionToken: signInData.session.access_token,
    };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    fail(
      `${label} sign-up failed: ${signUpError?.message ?? "no user returned"}`,
    );
  }

  if (!signUpData.session) {
    fail(
      `${label} requires email confirmation. In Supabase Auth → Email settings, disable "Enable email confirmations" for staging, then rerun.`,
    );
  }

  return {
    user: signUpData.user,
    sessionToken: signUpData.session.access_token,
  };
}

async function main() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is set. This smoke must run with the publishable/anon key only.",
    );
  }

  const config = getServerSupabaseConfig();
  if (!config.url || !config.publishableKey) {
    fail(
      "Supabase is not configured. Set UNSTANDARD_SUPABASE_URL and UNSTANDARD_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local.",
    );
  }

  const supabase = createClient(config.url, config.publishableKey);

  const runId = Date.now().toString(36);
  const emailA = `rls-smoke-a-${runId}@example.com`;
  const emailB = `rls-smoke-b-${runId}@example.com`;
  const password = `SmokePass-${runId}!`;

  console.log(`Running RLS adversarial smoke (runId=${runId})...`);
  console.log(`Target: ${config.url}`);

  const userA = await getOrCreateUser(supabase, "User A", emailA, password);
  const userB = await getOrCreateUser(supabase, "User B", emailB, password);

  const clientA = createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${userA.sessionToken}` } },
  });

  const clientB = createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${userB.sessionToken}` } },
  });

  // User A inserts their own profile and private profile.
  const { error: insertProfileAError } = await clientA.from("profiles").insert({
    id: userA.user.id,
    nickname: `smoke-a-${runId}`,
  });
  if (insertProfileAError) {
    fail(`User A cannot insert own profile: ${insertProfileAError.message}`);
  }

  const { error: insertPrivateAError } = await clientA
    .from("profile_private")
    .insert({
      profile_id: userA.user.id,
      letter: "secret letter",
    });
  if (insertPrivateAError) {
    fail(
      `User A cannot insert own profile_private: ${insertPrivateAError.message}`,
    );
  }

  // 1. Public profiles are readable by anyone.
  const { data: publicProfile, error: publicProfileError } = await clientB
    .from("profiles")
    .select("id, nickname")
    .eq("id", userA.user.id)
    .single();
  record(
    "B reads A public profile",
    publicProfile?.id === userA.user.id && !publicProfileError,
    publicProfileError?.message,
  );

  // 2. profile_private is NOT readable cross-user.
  const { data: privateAsB, error: privateAsBError } = await clientB
    .from("profile_private")
    .select("profile_id")
    .eq("profile_id", userA.user.id)
    .maybeSingle();
  record(
    "B cannot read A profile_private",
    !privateAsB && !privateAsBError,
    privateAsBError?.message,
  );

  // 3. profile_private is readable by owner.
  const { data: privateAsA, error: privateAsAError } = await clientA
    .from("profile_private")
    .select("profile_id, letter")
    .eq("profile_id", userA.user.id)
    .maybeSingle();
  record(
    "A reads own profile_private",
    privateAsA?.profile_id === userA.user.id && !privateAsAError,
    privateAsAError?.message,
  );

  // 4. B cannot update A's profile.
  const { error: updateBError } = await clientB
    .from("profiles")
    .update({ nickname: "hacked" })
    .eq("id", userA.user.id);
  record(
    "B cannot update A profile",
    !!updateBError,
    updateBError?.message,
  );

  // Cleanup data rows. Auth users remain in auth.users (service role required).
  await clientA.from("profile_private").delete().eq("profile_id", userA.user.id);
  await clientA.from("profiles").delete().eq("id", userA.user.id);

  // Report.
  console.log("\n=== RLS Adversarial Smoke Results ===");
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    console.log(
      `${icon} ${r.status}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`,
    );
    if (r.status === "PASS") passCount++;
    if (r.status === "FAIL") failCount++;
  }

  console.log(
    `\nPASS: ${passCount}, FAIL: ${failCount}, SKIP: ${results.length - passCount - failCount}`,
  );

  if (failCount > 0) {
    console.log(
      "\n❌ RLS adversarial smoke FAILED. Do not enable any adapter until all checks pass.",
    );
    process.exit(1);
  }

  console.log(
    "\n✅ RLS adversarial smoke PASSED. Migration and RLS policy behavior are consistent.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
