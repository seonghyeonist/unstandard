import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { identityService } from "../lib/identity/service";
import { type IdentityProvider, type IdentityRepository, type IdentityRequest } from "../lib/identity/contracts";
import { createPortOneIdentityProvider, parsePortOneIdentityConfig } from "../lib/identity/portone";
import { IDENTITY_PROVIDER_NOTICE_READY } from "../lib/identity/notice";
import { completeBrowserIdentity, startBrowserIdentity } from "../lib/identity/browser-flow";
import { GET as identityReturn } from "../app/api/identity/return/route";

const now = new Date("2026-08-28T00:00:00Z");
const requestId = "11111111-1111-4111-8111-111111111111";
const launch = { type: "portone" as const, storeId: "store-22222222-2222-4222-8222-222222222222",
  channelKey: "channel-key-33333333-3333-4333-8333-333333333333", identityVerificationId: requestId };
const request: IdentityRequest = { userId: "synthetic-user", requestId, profileRevision: "revision-1", provider: "test-only",
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
  const provider: IdentityProvider = { id: "test-only",
    start: async () => { calls++; return launch; }, verify: async () => { calls++; return proof; } };
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
  it("rejects arbitrary redirects, extra data and mismatched SDK requests", async () => {
    for (const result of [{ url: "https://evil.example" }, { ...launch, apiSecret: "synthetic" },
      { ...launch, identityVerificationId: "44444444-4444-4444-8444-444444444444" }]) {
      const f = fixture(); f.provider.start = async () => result as typeof launch;
      assert.equal((await identityService(f.deps).start(request.userId)).ok, false);
    }
  });
  it("rechecks the clock after a slow canonical lookup", async () => {
    const f = fixture(); let time = now;
    f.provider.verify = async () => { time = request.expiresAt; return f.proof; };
    assert.equal((await identityService({ ...f.deps, now: () => time }).complete(request.userId, requestId)).ok, false);
    assert.equal(f.completed(), 0);
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
    assert.match(factory, /if \(!IDENTITY_PROVIDER_NOTICE_READY\) return null/);
    assert.equal(IDENTITY_PROVIDER_NOTICE_READY, false, "release must publish reviewed provider terms before enabling");
    const migration = readFileSync("drizzle/migrations/0009_alpha_profile_identity.sql", "utf8");
    assert.doesNotMatch(migration, /\b(real_name|phone_number|phone|birth_date|ci|di|otp)\b/);
    assert.doesNotMatch(migration, /UPDATE\s+profiles/i);
  });
});

const env = { UNSTANDARD_IDENTITY_ENABLED: "true", PORTONE_STORE_ID: launch.storeId,
  PORTONE_IDENTITY_CHANNEL_KEY: launch.channelKey, PORTONE_API_SECRET: "synthetic-test-secret-not-a-credential" };
const config = parsePortOneIdentityConfig(env)!;
function canonical() {
  return { status: "VERIFIED", version: "V2", id: requestId, channel: { key: launch.channelKey, type: "LIVE", pgProvider: "DANAL" },
    verifiedAt: now.toISOString(), verifiedCustomer: { name: "Synthetic Name", phoneNumber: "01000000000", ci: "synthetic-ci", di: "synthetic-di", birthDate: "2000-01-01" },
    pgRawResponse: "synthetic-private-provider-data" };
}
describe("PortOne canonical adapter (synthetic HTTP only)", () => {
  it("keeps disabled, partial, malformed and control-character config closed", () => {
    assert.equal(parsePortOneIdentityConfig({}), null);
    for (const patch of [{ UNSTANDARD_IDENTITY_ENABLED: "false" }, { UNSTANDARD_IDENTITY_ENABLED: "test" },
      { PORTONE_STORE_ID: "other" }, { PORTONE_IDENTITY_CHANNEL_KEY: "other" }, { PORTONE_API_SECRET: "" },
      { PORTONE_API_SECRET: "secret\nAuthorization:bad" }]) assert.equal(parsePortOneIdentityConfig({ ...env, ...patch }), null);
  });
  it("start returns only public SDK inputs, without network traffic or personal data", async () => {
    const provider = createPortOneIdentityProvider(config, async () => { throw new Error("must not send"); });
    assert.deepEqual(await provider.start({ requestId }), launch);
  });
  it("binds store/channel/live Danal and returns only minimal proof", async () => {
    const provider = createPortOneIdentityProvider(config, async (url, init) => {
      assert.equal(String(url), `https://api.portone.io/identity-verifications/${requestId}?storeId=${launch.storeId}`);
      assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal); assert.equal(new Headers(init?.headers).get("authorization"), `PortOne ${env.PORTONE_API_SECRET}`);
      assert.equal(init?.body, undefined);
      return Response.json(canonical());
    });
    const result = await provider.verify(requestId);
    assert.deepEqual(result, { requestId, verifiedAt: now, realNameMatched: true, phoneOwnershipVerified: true });
    assert.doesNotMatch(JSON.stringify(result), /Synthetic Name|01000000000|synthetic-ci|synthetic-di|birthDate|pgRawResponse|secret/);
  });
  it("does not require or retain Danal's separately contracted phone-number return field", async () => {
    const response = canonical(); response.verifiedCustomer = { name: "Synthetic Name" } as typeof response.verifiedCustomer;
    assert.ok(await createPortOneIdentityProvider(config, async () => Response.json(response)).verify(requestId));
  });
  for (const [name, patch] of Object.entries({
    pending: { status: "READY" }, failed: { status: "FAILED" }, oldApi: { version: "V1" }, wrongRequest: { id: "stolen" },
    test: { channel: { ...canonical().channel, type: "TEST" } }, wrongChannel: { channel: { ...canonical().channel, key: "other" } },
    certificate: { channel: { ...canonical().channel, pgProvider: "INICIS_UNIFIED" } }, missingChannel: { channel: undefined },
    missingName: { verifiedCustomer: {} }, blankName: { verifiedCustomer: { name: " " } }, date: { verifiedAt: "invalid" },
  })) {
    it(`rejects ${name}`, async () => {
      assert.equal(await createPortOneIdentityProvider(config, async () => Response.json({ ...canonical(), ...patch })).verify(requestId), null);
    });
  }
  it("rejects malformed IDs without a provider call", async () => {
    let calls = 0;
    const p = createPortOneIdentityProvider(config, async () => { calls++; return Response.json(canonical()); });
    assert.equal(await p.verify("../other?secret=bad"), null); assert.equal(calls, 0);
  });
  it("fails closed on malformed, oversized and non-JSON responses without echoing raw errors", async () => {
    for (const response of [Response.json({ message: "synthetic-secret" }, { status: 401 }),
      new Response("synthetic-secret", { headers: { "Content-Type": "text/html" } }),
      new Response("invalid-json", { headers: { "Content-Type": "application/json" } }),
      Response.json({ ...canonical(), pgRawResponse: "x".repeat(65536) })]) {
      assert.equal(await createPortOneIdentityProvider(config, async () => response).verify(requestId), null);
    }
    for (const error of [new Error("synthetic-secret-name-phone"), new DOMException("timeout", "TimeoutError")]) {
      assert.equal(await createPortOneIdentityProvider(config, async () => { throw error; }).verify(requestId), null);
    }
  });
});

describe("browser identity flow (SDK stub, no paid authentication)", () => {
  function browserFixture() {
    const posts: { action: string; body: unknown }[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      posts.push({ action: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true, requestId, ...(String(url).endsWith("start") ? { launch } : {}) });
    };
    const sdkResponse = { transactionType: "IDENTITY_VERIFICATION" as const, identityVerificationId: requestId, identityVerificationTxId: "synthetic-tx" };
    const input = { origin: "https://unstandard.example", consentAccepted: true,
      onStarted: (id: string) => { assert.equal(id, requestId); }, sdk: async () => sdkResponse };
    return { posts, fetcher, input, sdkResponse };
  }
  it("sends no customer data and verifies the server-issued ID after SDK success", async () => {
    const f = browserFixture(); let sdkCalled = false;
    await startBrowserIdentity({ ...f.input, sdk: async (params) => {
      sdkCalled = true;
      assert.deepEqual(params, { storeId: launch.storeId, channelKey: launch.channelKey, identityVerificationId: requestId,
        redirectUrl: "https://unstandard.example/api/identity/return", bypass: { danal: { CPTITLE: "https://unstandard.example/profile-setup" } } });
      return f.sdkResponse;
    } }, f.fetcher);
    assert.equal(sdkCalled, true); assert.deepEqual(f.posts.map(p => p.action), ["/api/identity/start", "/api/identity/complete"]);
    assert.deepEqual(f.posts[1].body, { requestId });
  });
  it("does not convert mobile redirection into client-side success", async () => {
    const f = browserFixture(); await startBrowserIdentity({ ...f.input, sdk: async () => undefined }, f.fetcher);
    assert.equal(f.posts.length, 1);
  });
  it("blocks missing consent before API/SDK invocation", async () => {
    const f = browserFixture(); await assert.rejects(startBrowserIdentity({ ...f.input, consentAccepted: false }, f.fetcher));
    assert.equal(f.posts.length, 0);
  });
  it("ignores SDK error messages, exceptions and mismatched IDs", async () => {
    for (const response of [{ code: "CANCELLED", message: "raw-private", pgMessage: "raw-private" }, { identityVerificationId: "stolen" }]) {
      const f = browserFixture();
      await assert.rejects(startBrowserIdentity({ ...f.input, sdk: async () => ({ ...f.sdkResponse, ...response }) }, f.fetcher), e => !String(e).includes("raw-private"));
      assert.equal(f.posts.length, 1);
    }
    const f = browserFixture();
    await assert.rejects(startBrowserIdentity({ ...f.input, sdk: async () => { throw new Error("raw-private"); } }, f.fetcher), e => !String(e).includes("raw-private"));
  });
  it("SDK success cannot bypass canonical API failure; retry only submits the request ID", async () => {
    const f = browserFixture();
    await assert.rejects(startBrowserIdentity(f.input, async (url, init) => String(url).endsWith("complete") ? Response.json({ ok: false }, { status: 409 }) : f.fetcher(url, init)));
    await completeBrowserIdentity(requestId, f.fetcher);
    assert.deepEqual(f.posts.at(-1)?.body, { requestId });
  });
  it("return route strips all query parameters and never grants verification on GET", () => {
    const response = identityReturn();
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), "/profile-setup");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  });
});
