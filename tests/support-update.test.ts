import assert from "node:assert/strict";
import { it } from "node:test";
import { parseSupportUpdate } from "../lib/server/support/contracts";
const base = { expectedStatus: "OPEN", expectedUpdatedAt: "2026-10-09T00:00:00.000Z", status: "IN_PROGRESS", assignedTo: "seonghyeonist", response: null };
it("requires a known owner, valid concurrency token and known status", () => {
  assert.ok(parseSupportUpdate(base));
  for (const change of [{ assignedTo: "arbitrary" }, { status: "DELETED" }, { expectedStatus: "unknown" }, { expectedUpdatedAt: "not-a-date" }, { expectedUpdatedAt: null }, { response: {} }]) assert.equal(parseSupportUpdate({ ...base, ...change }), null);
});
it("closing requires a bounded member-visible answer", () => {
  assert.equal(parseSupportUpdate({ ...base, status: "CLOSED" }), null);
  assert.equal(parseSupportUpdate({ ...base, response: "short" }), null);
  assert.equal(parseSupportUpdate({ ...base, response: "a".repeat(2001) }), null);
  assert.equal(parseSupportUpdate({ ...base, status: "CLOSED", response: "  Synthetic reply delivered.  " })?.response, "Synthetic reply delivered.");
});
