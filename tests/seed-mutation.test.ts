import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_CLOSED_ALPHA_SEED,
  seedClosedAlphaDataWithSql,
  type SeedDataset,
} from "../lib/db/seed-data";

describe("seed mutation outcomes", () => {
  it("first insert returns changed=true; identical second run changed=false", async () => {
    let questionCalls = 0;
    let configCalls = 0;
    const sql = async () => {
      // Alternating question then config within each seed call.
      if (questionCalls === configCalls) {
        questionCalls += 1;
        return questionCalls === 1 ? [{ id: "q1" }] : [];
      }
      configCalls += 1;
      return configCalls === 1 ? [{ key: "k1" }] : [];
    };

    const dataset: SeedDataset = {
      question: {
        id: "test-q",
        prompt: "p",
        helper: null,
        active: true,
      },
      appConfig: { key: "test.k", value: { v: 1 } },
    };

    const first = await seedClosedAlphaDataWithSql(sql as never, dataset);
    assert.deepEqual(first, { questionChanged: true, appConfigChanged: true });

    const second = await seedClosedAlphaDataWithSql(sql as never, dataset);
    assert.deepEqual(second, { questionChanged: false, appConfigChanged: false });
  });

  it("changed value returns changed=true then repeated returns false", async () => {
    const responses: Array<Record<string, unknown>[]> = [
      [{ id: "q" }],
      [{ key: "k" }],
      [],
      [],
    ];
    const sql = async () => {
      const next = responses.shift();
      assert.ok(next);
      return next;
    };

    const dataset = {
      ...DEFAULT_CLOSED_ALPHA_SEED,
      question: { ...DEFAULT_CLOSED_ALPHA_SEED.question, prompt: "changed" },
    };
    const changed = await seedClosedAlphaDataWithSql(sql as never, dataset);
    assert.equal(changed.questionChanged, true);
    assert.equal(changed.appConfigChanged, true);

    const again = await seedClosedAlphaDataWithSql(sql as never, dataset);
    assert.equal(again.questionChanged, false);
    assert.equal(again.appConfigChanged, false);
  });

  it("SQL uses RETURNING and IS DISTINCT FROM (behavioral source support)", () => {
    const source = readFileSync(join(process.cwd(), "lib/db/seed-data.ts"), "utf8");
    assert.match(source, /RETURNING id/);
    assert.match(source, /RETURNING key/);
    assert.match(source, /IS DISTINCT FROM/);
    assert.match(source, /SeedMutationOutcome/);
    assert.match(source, /DEFAULT_CLOSED_ALPHA_SEED/);
  });

  it("operator CLI seeds the default dataset", () => {
    const source = readFileSync(join(process.cwd(), "scripts/db/seed.ts"), "utf8");
    assert.match(source, /seedClosedAlphaData\(url\)/);
  });
});
