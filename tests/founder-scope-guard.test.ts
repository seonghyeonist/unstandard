import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("founder decision scope guard", () => {
  it("keeps payment and subscription dependencies out of Closed Alpha", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const names = Object.keys(pkg.dependencies ?? {});
    assert.equal(names.some((name) => /stripe|paddle|lemonsqueezy|billing|payment/iu.test(name)), false);
  });

  it("contains a database-enforced 50-seat guard", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle/migrations/0005_alpha_stage1_measurement.sql"),
      "utf8",
    );
    assert.match(migration, /pg_advisory_xact_lock/iu);
    assert.match(migration, /active_seats >= 50/iu);
    assert.match(migration, /alpha_stage1_capacity_guard/iu);
    assert.match(migration, /DEFAULT 'legacy_pre_stage1'/iu);
    assert.match(migration, /SET DEFAULT 'alpha_stage_1'/iu);
  });

  it("preserves a reserved invite during failed-registration compensation", () => {
    const finalization = readFileSync(
      join(process.cwd(), "lib/auth/invite-finalization.ts"),
      "utf8",
    );
    const migration = readFileSync(
      join(process.cwd(), "drizzle/migrations/0005_alpha_stage1_measurement.sql"),
      "utf8",
    );
    assert.match(finalization, /unstandard\.registration_compensation/iu);
    assert.match(migration, /registration_compensation/iu);
    assert.match(migration, /IS DISTINCT FROM 'on'/iu);
  });

  it("serializes block creation and message sends on the same pair lock", () => {
    const messages = readFileSync(
      join(process.cwd(), "lib/db/repositories/messages.repository.ts"),
      "utf8",
    );
    const blocks = readFileSync(
      join(process.cwd(), "lib/db/repositories/blocks.repository.ts"),
      "utf8",
    );
    assert.match(messages, /lockConversationPair/iu);
    assert.match(blocks, /lockConversationPair/iu);
  });
});
