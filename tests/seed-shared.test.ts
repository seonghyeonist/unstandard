import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CLOSED_ALPHA_SEED,
  SEED_APP_CONFIG_KEY,
  SEED_APP_CONFIG_VALUE,
  seedOnboardingQuestion,
} from "../lib/db/seed-data";

describe("shared seed implementation", () => {
  it("operator seed script uses shared default dataset", () => {
    const source = readFileSync(join(process.cwd(), "scripts/db/seed.ts"), "utf8");
    assert.match(source, /seedClosedAlphaData/);
    assert.match(source, /seedClosedAlphaData\(url\)/);
  });

  it("seed module exports mutation outcomes and default dataset", () => {
    assert.equal(DEFAULT_CLOSED_ALPHA_SEED.appConfig.key, SEED_APP_CONFIG_KEY);
    assert.equal(SEED_APP_CONFIG_VALUE.enabled, true);
    assert.ok(seedOnboardingQuestion.id);
    assert.equal(DEFAULT_CLOSED_ALPHA_SEED.question.id, seedOnboardingQuestion.id);
  });

  it("integration migrations suite uses unique test dataset and cleanup", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/integration/suite/migrations.test.ts"),
      "utf8",
    );
    assert.match(source, /seedClosedAlphaData\(url, dataset\)/);
    assert.match(source, /questionChanged/);
    assert.match(source, /appConfigChanged/);
    assert.match(source, /finally/);
    assert.match(source, /DELETE FROM questions/);
  });
});
