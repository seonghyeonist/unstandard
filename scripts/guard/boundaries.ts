import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const CLIENT_MARKERS = ['"use client"', "'use client'"];
const FORBIDDEN_IN_CLIENT = [
  "@/lib/db/",
  "drizzle-orm",
  "@neondatabase/serverless",
  'from "server-only"',
];

const SCAN_DIRS = ["app", "components", "lib/api"];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "drizzle") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

let failed = false;

for (const scanDir of SCAN_DIRS) {
  const base = join(ROOT, scanDir);
  if (!existsSync(base)) continue;

  for (const file of walk(base)) {
    const content = readFileSync(file, "utf8");
    const isClient = CLIENT_MARKERS.some((marker) => content.includes(marker));
    if (!isClient) continue;

    for (const forbidden of FORBIDDEN_IN_CLIENT) {
      if (content.includes(forbidden)) {
        failed = true;
        console.error(`client boundary violation: ${file} imports ${forbidden}`);
      }
    }
  }
}

assert.equal(failed, false, "import boundary violations found");
console.log("guard:boundaries PASS");
