import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { identityService } from "../lib/identity/service";
import { type IdentityProvider, type IdentityRepository, type IdentityRequest } from "../lib/identity/contracts";

const now = new Date("2026-08-28T00:00:00Z");
const request: IdentityRequest = { userId: "synthetic-user", requestId: "request-1", profileRevision: "revision-1", provider: "test-only",
  requestedAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 60_000), status: "pending" };
function fixture() {
  let calls = 0;
  let completed = 0;
  const repo: IdentityRepository = {
    begin: async () => request,
    find: async (userId, requestId) => userId === request.userId && requestId === request.requestId ? request : null,
    complete: async () => { completed++; return true; },
  };
  const proof = { requestId: request.requestId, verifiedAt: now, realNameMatched: true, phoneOwnershipVerified: true };
  const provider: IdentityProvider = { id: "test-only", allowedOrigins: ["https://identity.example"],
    start: async () => { calls++; return { url: "https://identity.example/start" }; }, verify: async () => { calls++; return proof; } };
  const deps = { provider: provider as IdentityProvider | null, repository: repo, limit: async () => true, now: () => now };
  return { deps, repo, provider, proof, calls: () => calls, completed: () => completed };
}
describe("identity verification boundary", () => {
  it("no provider: no request, paid send, or verified write", async () => {
    const f = fixture(); f.deps.provider = null;
    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.equal(f.calls(), 0); assert.equal(f.completed(), 0);
  });
  it("persists only after canonical proof of BOTH real name and phone ownership", async () => {
    const f = fixture(); assert.equal((await identityService(f.deps).complete(request.userId, request.requestId)).ok, true);
    assert.equal(f.completed(), 1);
  });
  for (const patch of [{ realNameMatched: false }, { phoneOwnershipVerified: false }, { requestId: "stolen" },
    { verifiedAt: new Date("2020-01-01") }, { verifiedAt: new Date("2030-01-01") }, { verifiedAt: new Date("invalid") }]) {
    it(`rejects bad provider proof ${JSON.stringify(patch)}`, async () => {
      const f = fixture(); Object.assign(f.proof, patch);
      assert.equal((await identityService(f.deps).complete(request.userId, request.requestId)).ok, false);
      assert.equal(f.completed(), 0);
    });
  }
  it("rejects another user's request before contacting provider", async () => {
    const f = fixture(); assert.equal((await identityService(f.deps).complete("attacker", request.requestId)).ok, false);
    assert.equal(f.calls(), 0);
  });
  it("rejects expiry before provider call", async () => {
    const f = fixture(); f.repo.find = async () => ({ ...request, expiresAt: now });
    assert.equal((await identityService(f.deps).complete(request.userId, request.requestId)).ok, false); assert.equal(f.calls(), 0);
  });
  it("limits spending before start; storage outage is fail closed", async () => {
    for (const unavailable of [false, true]) {
      const f = fixture(); f.deps.limit = async () => { if (unavailable) throw new Error("storage down"); return false; };
      assert.equal((await identityService(f.deps).start(request.userId)).ok, false); assert.equal(f.calls(), 0);
    }
  });
  it("applies per-account and global caps before a paid request", async () => {
    const f = fixture(); const scopes: string[] = [];
    const service = identityService({ ...f.deps, limit: async (scope) => { scopes.push(scope); return scope !== "identityGlobal"; } });
    assert.equal((await service.start(request.userId)).ok, false);
    assert.deepEqual(scopes, ["identityStart", "identityGlobal"]); assert.equal(f.calls(), 0);
  });
  it("rejects unsafe provider redirects", async () => {
    for (const url of ["http://identity.example", "https://evil.example", "https://user:password@identity.example"]) {
      const f = fixture(); f.provider.start = async () => ({ url });
      assert.equal((await identityService(f.deps).start(request.userId)).ok, false);
    }
  });
  it("rechecks profile revision after provider roundtrip", async () => {
    const f = fixture(); f.repo.complete = async () => false;
    assert.equal((await identityService(f.deps).complete(request.userId, request.requestId)).ok, false);
  });
  it("redacts provider exceptions, even if they contain raw identifying data", async () => {
    const f = fixture(); f.provider.verify = async () => { throw new Error("synthetic raw-name phone OTP"); };
    const result = await identityService(f.deps).complete(request.userId, request.requestId);
    assert.deepEqual(result, { ok: false, code: "PROVIDER_UNAVAILABLE" });
  });
  it("production factory has no fake/manual-success mode or raw payload persistence", () => {
    const factory = readFileSync("lib/server/identity/provider.ts", "utf8");
    assert.match(factory, /return null/);
    assert.doesNotMatch(factory, /process\.env/);
    const migration = readFileSync("drizzle/migrations/0009_alpha_profile_identity.sql", "utf8");
    assert.doesNotMatch(migration, /\b(real_name|phone_number|phone|birth_date|ci|di|otp)\b/);
    assert.doesNotMatch(migration, /UPDATE\s+profiles/i);
  });
});
