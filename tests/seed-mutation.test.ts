import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_CLOSED_ALPHA_SEED,
  seedClosedAlphaDataWithSql,
  type SeedDataset,
} from "../lib/db/seed-data";

function makeSequentialSql(responses: Array<Record<string, unknown>[]>) {
  return async () => {
    const next = responses.shift();
    assert.ok(next !== undefined, "unexpected extra SQL call");
    return next;
  };
}

describe("seed mutation outcomes", () => {
  it("first insert returns changed=true; identical second run changed=false", async () => {
    const firstResponses: Array<Record<string, unknown>[]> = [
      [{ id: "q1" }], // onboarding question
      [{ id: "q2" }], // unlock question
      [{ key: "k1" }], // alpha.closed
      [{ key: "k2" }], // unlock.active_question_id
      [], // profile public enrich
      [], // profile private enrich
    ];
    const secondResponses: Array<Record<string, unknown>[]> = [
      [],
      [],
      [],
      [],
      [],
      [],
    ];

    const dataset = DEFAULT_CLOSED_ALPHA_SEED;
    const first = await seedClosedAlphaDataWithSql(makeSequentialSql(firstResponses) as never, dataset);
    assert.equal(first.questionChanged, true);
    assert.equal(first.unlockQuestionChanged, true);
    assert.equal(first.appConfigChanged, true);
    assert.equal(first.unlockQuestionConfigChanged, true);

    const second = await seedClosedAlphaDataWithSql(
      makeSequentialSql(secondResponses) as never,
      dataset,
    );
    assert.equal(second.questionChanged, false);
    assert.equal(second.unlockQuestionChanged, false);
    assert.equal(second.appConfigChanged, false);
    assert.equal(second.unlockQuestionConfigChanged, false);
  });

  it("changed value returns changed=true then repeated returns false", async () => {
    const responses: Array<Record<string, unknown>[]> = [
      [{ id: "q" }],
      [],
      [{ key: "k" }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ];
    const dataset: SeedDataset = {
      ...DEFAULT_CLOSED_ALPHA_SEED,
      question: { ...DEFAULT_CLOSED_ALPHA_SEED.question, prompt: "changed" },
    };
    const changed = await seedClosedAlphaDataWithSql(makeSequentialSql(responses) as never, dataset);
    assert.equal(changed.questionChanged, true);
    assert.equal(changed.appConfigChanged, true);

    const again = await seedClosedAlphaDataWithSql(makeSequentialSql(responses) as never, dataset);
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
    assert.match(source, /unlock\.active_question_id|UNLOCK_QUESTION_CONFIG_KEY/);
  });

  it("operator CLI seeds the default dataset", () => {
    const source = readFileSync(join(process.cwd(), "scripts/db/seed.ts"), "utf8");
    assert.match(source, /seedClosedAlphaData\(url\)/);
  });
});
