import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertIntegrationFixtureBaselineRestored } from "@/lib/readiness/integration-fixture-baseline";

describe("integration fixture baseline", () => {
  it("accepts exact restoration", () => {
    assert.doesNotThrow(() =>
      assertIntegrationFixtureBaselineRestored(
        { users: 5, profiles: 5, alpha_invites: 12 },
        { users: 5, profiles: 5, alpha_invites: 12 },
      ),
    );
  });

  it("fails closed when a proof suite leaks rows", () => {
    assert.throws(
      () =>
        assertIntegrationFixtureBaselineRestored(
          { users: 5, profiles: 5, alpha_invites: 12 },
          { users: 12, profiles: 12, alpha_invites: 12 },
        ),
      /users before=5 after=12; profiles before=5 after=12/u,
    );
  });
});
