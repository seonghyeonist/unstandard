#!/usr/bin/env tsx
// Minimal RLS adversarial smoke — Unstandard staging only.
// This is a safe starting stub. The full adversarial test suite is tracked in
// PR #35 (branch cursor/rls-adversarial-smoke-2aa9 @ 0f51c42); do NOT merge it here.
//
// Rules before running:
//   - Target must be Unstandard-staging only.
//   - Do NOT enable REPORTS_PERSISTENCE_ADAPTER.
//   - Do NOT use SUPABASE_SERVICE_ROLE_KEY.
//   - Run only after `npm run db:staging:push` has applied migrations with RLS.

import { createClient } from "@supabase/supabase-js";

const url = process.env.UNSTANDARD_SUPABASE_URL;
const key = process.env.UNSTANDARD_SUPABASE_PUBLISHABLE_KEY;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function warn(message: string) {
  console.warn(`WARN: ${message}`);
}

async function main() {
  if (!url || !key) {
    fail(
      "UNSTANDARD_SUPABASE_URL and UNSTANDARD_SUPABASE_PUBLISHABLE_KEY must be set. " +
        "Use the staging anon key only; never the service role key."
    );
  }

  const redactedUrl = url.replace(/\/\/([^.]+)\./, "//<ref>.");
  console.log("== Minimal RLS smoke (Unstandard-staging only) ==");
  console.log(`Target: ${redactedUrl}`);

  if (!url.includes("-staging-")) {
    warn("Supabase URL does not look like the staging project. Verify target before continuing.");
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Basic connectivity: anonymous users should be able to read public profiles (per RLS draft).
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id")
    .limit(1);

  if (profilesError && profilesError.code === "PGRST301") {
    fail("profiles table is blocked to anon — expected public SELECT policy per RLS draft.");
  }
  console.log(`PASS: profiles public SELECT reachable (got ${profiles?.length ?? 0} row(s))`);

  // Critical: anonymous users must NOT be able to read private tables.
  const privateTables = ["profile_private", "answers", "depth_evaluations", "reports", "blocks"];
  let blocked = 0;
  for (const table of privateTables) {
    const { error } = await client.from(table).select("*").limit(1);
    if (error && (error.code === "PGRST301" || error.message?.toLowerCase().includes("row-level"))) {
      console.log(`PASS: anon read blocked on ${table}`);
      blocked += 1;
    } else if (!error) {
      console.log(`FAIL: anon read allowed on ${table}`);
    } else {
      console.log(`INFO: anon read on ${table} returned ${error.code} — ${error.message}`);
    }
  }

  if (blocked !== privateTables.length) {
    fail("One or more private tables are readable by anon. Do NOT enable any adapter.");
  }

  warn("This is a minimal stub. Replace with PR #35 full adversarial suite before enabling adapter.");
  console.log("Minimal RLS smoke passed.");
}

main().catch((err) => fail(String(err)));
