import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SEED_APP_CONFIG_KEY,
  SEED_APP_CONFIG_VALUE,
  seedOnboardingQuestion,
} from "../lib/db/seed-data";

describe("shared seed implementation", () => {
  it("operator seed script uses shared implementation", () => {
    const source = readFileSync(join(process.cwd(), "scripts/db/seed.ts"), "utf8");
    assert.match(source, /seedClosedAlphaData/);
    assert.doesNotMatch(source, /ON CONFLICT \(key\) DO UPDATE SET\s+value = EXCLUDED\.value,\s+updated_at = now\(\)\s*;/);
  });

  it("seed module uses conditional updated_at (IS DISTINCT FROM)", () => {
    const source = readFileSync(join(process.cwd(), "lib/db/seed-data.ts"), "utf8");
    assert.match(source, /IS DISTINCT FROM EXCLUDED\.value/);
    assert.match(source, /IS DISTINCT FROM EXCLUDED\.prompt/);
    assert.match(source, new RegExp(SEED_APP_CONFIG_KEY));
    assert.equal(SEED_APP_CONFIG_VALUE.enabled, true);
    assert.ok(seedOnboardingQuestion.id);
  });

  it("integration migrations suite calls shared seed (not duplicated SQL)", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/integration/suite/migrations.test.ts"),
      "utf8",
    );
    assert.match(source, /seedClosedAlphaData/);
    assert.doesNotMatch(source, /async function runSeed/);
    assert.match(source, /updated_at/);
  });
});
