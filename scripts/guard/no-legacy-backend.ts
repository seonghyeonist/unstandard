import { execSync } from "node:child_process";

const patterns = [
  "supabase",
  "@supabase",
  "UNSTANDARD_SUPABASE",
  "NEXT_PUBLIC_SUPABASE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "sb_publishable",
  "smoke:rls",
  "db:staging:push",
  "db:staging:dry-run",
];

let failed = false;

for (const pattern of patterns) {
  const output = execSync(`git grep -n -i "${pattern}" -- . ":(exclude)scripts/guard/no-legacy-backend.ts" || true`, {
    encoding: "utf8",
  }).trim();

  if (output) {
    failed = true;
    console.error(`FOUND legacy pattern "${pattern}":\n${output}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("guard:no-legacy-backend PASS");
