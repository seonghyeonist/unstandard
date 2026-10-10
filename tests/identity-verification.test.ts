import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createDiditIdentityProvider, parseDiditIdentityConfig } from "../lib/identity/didit";
import { matchesExpectedDiditEnvironment } from "../lib/identity/didit-environment";
import { reconcileIdentityCompletions } from "../lib/identity/reconciliation";
import { identityService } from "../lib/identity/service";
import { classifyIdentityReadiness } from "../lib/identity/readiness";
import {
  IDENTITY_BIOMETRIC_CONSENT_VERSION,
  IDENTITY_NOTICE_VERSION,
  type IdentityProvider,
  type IdentityRepository,
  type IdentityRequest,
} from "../lib/identity/contracts";
import { IDENTITY_PROVIDER_NOTICE_READY } from "../lib/identity/notice";
import { completeBrowserIdentity, startBrowserIdentity } from "../lib/identity/browser-flow";
import {
  canonicalizeDiditWebhook,
  diditSessionWebhookSchema,
  diditWebhookSignatureAllowed,
  verifyDiditWebhookRawSignature,
  verifyDiditWebhookSimpleSignature,
  verifyDiditWebhookSignature,
} from "../lib/identity/didit-webhook";
import { GET as identityReturn } from "../app/api/identity/return/route";

const now = new Date("2026-08-28T00:00:00Z");
const requestId = "11111111-1111-4111-8111-111111111111";
const providerReference = "22222222-2222-4222-8222-222222222222";
const workflowId = "33333333-3333-4333-8333-333333333333";
const launch = { type: "didit" as const, providerReference, url: `https://verify.didit.me/session/${providerReference}` };
const request: IdentityRequest = {
  userId: "synthetic-user",
  requestId,
  profileRevision: "44444444-4444-4444-8444-444444444444",
  provider: "didit-v3",
  providerReference,
  biometricConsentVersion: IDENTITY_BIOMETRIC_CONSENT_VERSION,
  requestedAt: new Date(now.getTime() - 1000),
  expiresAt: new Date(now.getTime() + 60_000),
  completionRequestedAt: null,
  completionEventId: null,
  verifiedAt: null,
  providerPurgedAt: null,
  status: "pending",
};

function fixture() {
  let calls = 0;
  let starts = 0;
  let unpurged = 0;
  let purged = 0;
  const current = { ...request };
  const purgeEntries = new Map<string, { requestId: string; provider: string; providerReference: string }>();
  const purgeQueue = {
    async enqueueProviderPurge(entry: { requestId: string; provider: string; providerReference: string }) {
      const existing = purgeEntries.get(entry.requestId);
      if (existing && (existing.provider !== entry.provider || existing.providerReference !== entry.providerReference)) {
        throw new Error("queue conflict");
      }
      purgeEntries.set(entry.requestId, entry);
    },
    async hasProviderPurge(id: string) { return purgeEntries.has(id); },
    async deleteProviderPurge(entry: { requestId: string; provider: string; providerReference: string }) {
      const existing = purgeEntries.get(entry.requestId);
      if (!existing || existing.provider !== entry.provider || existing.providerReference !== entry.providerReference) return false;
      return purgeEntries.delete(entry.requestId);
    },
  };
  const repo: IdentityRepository = {
    begin: async () => current,
    removePending: async () => { current.providerReference = null; current.status = "pending"; return true; },
    findCurrent: async () => current,
    find: async (userId, id) => userId === current.userId && id === current.requestId ? current : null,
    findByProviderReference: async (reference) => reference === current.providerReference ? current : null,
    bindProviderReference: async (_request, reference) => { current.providerReference = reference; return true; },
    markCompletionRequested: async (_request, eventId, at) => {
      current.completionEventId = eventId;
      current.completionRequestedAt = at;
      return true;
    },
    listCompletionRequests: async () => (
      current.completionRequestedAt ||
      current.status === "verified_unpurged" ||
      (current.status === "pending" && current.expiresAt <= now)
    ) ? [current] : [],
    clearCompletionRequested: async () => {
      current.completionEventId = null;
      current.completionRequestedAt = null;
      return true;
    },
    markVerifiedUnpurged: async (_request, proof) => {
      current.status = "verified_unpurged";
      current.verifiedAt = proof.verifiedAt;
      unpurged++;
      return true;
    },
    markVerified: async (_request, purgedAt) => {
      current.status = "verified";
      current.providerPurgedAt = purgedAt;
      purged++;
      return true;
    },
  };
  const proof = {
    requestId,
    providerReference,
    verifiedAt: now,
    documentVerified: true,
    livenessVerified: true,
    faceMatchVerified: true,
    deviceIpVerified: true,
    adultVerified: true,
  };
  const provider: IdentityProvider = {
    id: "didit-v3",
    start: async () => { calls++; starts++; return launch; },
    verify: async () => { calls++; return proof; },
    purge: async () => { calls++; return true; },
  };
  const deps = { provider: provider as IdentityProvider | null, repository: repo, purgeQueue, limit: async () => true, now: () => now };
  return { deps, repo, provider, proof, calls: () => calls, starts: () => starts, queuedProviderPurges: () => [...purgeEntries.values()], unpurged: () => unpurged, purged: () => purged };
}

describe("identity verification boundary", () => {
  it("no provider: no request, paid call, or verified write", async () => {
    const f = fixture(); f.deps.provider = null;
    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.equal(f.calls(), 0); assert.equal(f.unpurged(), 0); assert.equal(f.purged(), 0);
  });
  it("queues a session durably when binding fails and immediate purge returns false", async () => {
    const f = fixture();
    (await f.repo.findCurrent(request.userId))!.providerReference = null;
    f.repo.bindProviderReference = async () => false;
    f.provider.purge = async () => false;

    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PURGE_PENDING" });
    assert.deepEqual(f.queuedProviderPurges(), [{ requestId, provider: "didit-v3", providerReference }]);
    const starts = f.starts();
    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PURGE_PENDING" });
    assert.equal(f.starts(), starts, "a new provider session waits until the queued purge is reconciled");
  });

  it("keeps a failed-bind session queued when immediate purge throws", async () => {
    const f = fixture();
    (await f.repo.findCurrent(request.userId))!.providerReference = null;
    f.repo.bindProviderReference = async () => false;
    f.provider.purge = async () => { throw new Error("synthetic purge failure"); };

    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PURGE_PENDING" });
    assert.deepEqual(f.queuedProviderPurges(), [{ requestId, provider: "didit-v3", providerReference }]);
  });

  it("removes the queued cleanup after a failed bind is immediately purged", async () => {
    const f = fixture();
    (await f.repo.findCurrent(request.userId))!.providerReference = null;
    f.repo.bindProviderReference = async () => false;
    f.provider.purge = async () => true;

    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.deepEqual(f.queuedProviderPurges(), []);
  });

  it("keeps the normal start result unchanged without creating a purge record", async () => {
    const f = fixture();
    (await f.repo.findCurrent(request.userId))!.providerReference = null;

    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: true, requestId, launch });
    assert.deepEqual(f.queuedProviderPurges(), []);
  });

  it("requires all four provider-neutral proof bits and confirms purge before success", async () => {
    const f = fixture();
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: true, requestId });
    assert.equal(f.unpurged(), 1); assert.equal(f.purged(), 1);
  });
  for (const patch of [
    { documentVerified: false }, { livenessVerified: false }, { faceMatchVerified: false }, { deviceIpVerified: false }, { adultVerified: false },
    { requestId: "stolen" }, { providerReference: "stolen" }, { verifiedAt: new Date("2020-01-01") },
    { verifiedAt: new Date("2030-01-01") }, { verifiedAt: new Date("invalid") },
  ]) {
    it(`rejects bad provider proof ${JSON.stringify(patch)}`, async () => {
      const f = fixture(); Object.assign(f.proof, patch);
      assert.equal((await identityService(f.deps).complete(request.userId, request.requestId)).ok, false);
      assert.equal(f.unpurged(), 0); assert.equal(f.purged(), 0);
    });
  }
  it("does not unlock while provider deletion is pending", async () => {
    const f = fixture(); f.provider.purge = async () => false;
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: false, code: "PURGE_PENDING" });
    assert.equal(f.unpurged(), 1); assert.equal(f.purged(), 0);
  });
  it("rejects another user's request before contacting provider", async () => {
    const f = fixture(); assert.equal((await identityService(f.deps).complete("attacker", request.requestId)).ok, false);
    assert.equal(f.calls(), 0);
  });
  it("purges an expired session without a canonical decision lookup", async () => {
    const f = fixture(); f.repo.find = async () => ({ ...request, expiresAt: now });
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: false, code: "VERIFICATION_FAILED" });
    assert.equal(f.calls(), 1, "provider purge only");
  });
  it("limits spending before start; storage outage is fail closed", async () => {
    for (const unavailable of [false, true]) {
      const f = fixture(); f.deps.limit = async () => { if (unavailable) throw new Error("storage down"); return false; };
      assert.equal((await identityService(f.deps).start(request.userId)).ok, false); assert.equal(f.calls(), 0);
    }
  });
  it("reconciles a timely signed completion after browser TTL with canonical lookup and purge", async () => {
    const f = fixture();
    const current = (await f.repo.findCurrent(request.userId))!;
    current.expiresAt = new Date(now.getTime() - 60_000);
    current.requestedAt = new Date(now.getTime() - 120_000);
    current.completionRequestedAt = new Date(now.getTime() - 90_000);
    current.completionEventId = requestId;
    assert.deepEqual(await identityService(f.deps).complete(request.userId, requestId), { ok: true, requestId });
    assert.equal(f.calls(), 2);
    assert.equal(f.unpurged(), 1);
    assert.equal(f.purged(), 1);
  });
  it("rejects late, unsigned, future and over-grace completion signals", async () => {
    for (const kind of ["late", "unsigned", "future", "over-grace"]) {
      const f = fixture();
      const current = (await f.repo.findCurrent(request.userId))!;
      current.expiresAt = new Date(now.getTime() - (kind === "over-grace" ? 3_600_001 : 60_000));
      current.requestedAt = new Date(current.expiresAt.getTime() - 600_000);
      current.completionRequestedAt = new Date(current.expiresAt.getTime() - 1000);
      current.completionEventId = requestId;
      if (kind === "late") current.completionRequestedAt = current.expiresAt;
      if (kind === "future") current.completionRequestedAt = new Date(now.getTime() + 1000);
      if (kind === "unsigned") current.completionEventId = null;
      assert.equal((await identityService(f.deps).complete(request.userId, requestId)).ok, false, kind);
      assert.equal(f.unpurged(), 0, kind);
      assert.equal(f.calls(), 1, "purge only");
    }
  });
  it("never sends a stale external reference to a different provider", async () => {
    const f = fixture();
    f.repo.begin = async () => ({ ...request, provider: "old-provider", providerReference });
    assert.deepEqual(await identityService(f.deps).start(request.userId), { ok: false, code: "PROVIDER_UNAVAILABLE" });
    assert.equal(f.calls(), 0);
  });
  it("applies per-account and global caps before a paid request", async () => {
    const f = fixture(); const scopes: string[] = [];
    const service = identityService({ ...f.deps, limit: async (scope) => { scopes.push(scope); return scope !== "identityGlobal"; } });
    assert.equal((await service.start(request.userId)).ok, false);
    assert.deepEqual(scopes, ["identityStart", "identityGlobal"]); assert.equal(f.calls(), 0);
  });
  it("rejects arbitrary launch URLs, provider references and extra launch fields", async () => {
    for (const result of [
      { ...launch, url: "https://evil.example/session" },
      { ...launch, providerReference: "not-a-uuid" },
      { ...launch, apiKey: "synthetic" },
    ]) {
      const f = fixture(); f.provider.start = async () => result as typeof launch;
      assert.equal((await identityService(f.deps).start(request.userId)).ok, false);
    }
  });
  it("rechecks the clock after a slow canonical lookup and profile write", async () => {
    const f = fixture(); let time = now;
    f.provider.verify = async () => { time = request.expiresAt; return f.proof; };
    assert.equal((await identityService({ ...f.deps, now: () => time }).complete(request.userId, requestId)).ok, false);
    assert.equal(f.unpurged(), 0);
    const f2 = fixture(); f2.repo.markVerifiedUnpurged = async () => false;
    assert.equal((await identityService(f2.deps).complete(request.userId, requestId)).ok, false);
  });
  it("redacts provider exceptions, even if they contain raw identifying data", async () => {
    const f = fixture(); f.provider.verify = async () => { throw new Error("synthetic raw-name private-number"); };
    const result = await identityService(f.deps).complete(request.userId, request.requestId);
    assert.deepEqual(result, { ok: false, code: "PROVIDER_UNAVAILABLE" });
  });
  it("purges and removes a conclusive non-approved request before allowing a retry", async () => {
    const f = fixture(); let purges = 0;
    f.provider.verify = async () => null;
    f.provider.purge = async () => { purges++; return true; };
    assert.deepEqual(await identityService(f.deps).complete(request.userId, request.requestId), { ok: false, code: "VERIFICATION_FAILED" });
    assert.equal(purges, 1, "conclusive rejection is purged before the row is removed");
    assert.equal(f.repo.findCurrent ? (await f.repo.findCurrent(request.userId))?.providerReference : undefined, null);
  });
  it("emits PII-free diagnostic codes when a provider call fails", async () => {
    const f = fixture(); const events: unknown[] = [];
    f.provider.verify = async () => { throw new Error("synthetic raw-name private-number"); };
    await identityService({ ...f.deps, log: (event) => events.push(event) }).complete(request.userId, request.requestId);
    assert.match(JSON.stringify(events), /canonical_decision_request_failed/);
    assert.doesNotMatch(JSON.stringify(events), /raw-name|private-number/);
  });
  it("publishes the reviewed notice while keeping environment/config readiness fail-closed", () => {
    const factory = readFileSync("lib/server/identity/provider.ts", "utf8");
    const privacy = readFileSync("app/privacy/page.tsx", "utf8");
    const profile = readFileSync("components/profile/profile-basics-form.tsx", "utf8");
    assert.equal(IDENTITY_NOTICE_VERSION, "alpha-identity-v3");
    assert.equal(IDENTITY_BIOMETRIC_CONSENT_VERSION, "alpha-biometric-identity-v3");
    assert.match(privacy, /identity notice v3/);
    assert.match(privacy, /Didit Identity Spain, S\.L\./);
    assert.match(privacy, /주된 처리 인프라는 EEA/);
    assert.match(privacy, /기본 보관은 무제한/);
    assert.match(privacy, /Sandbox 설정은 1개월/);
    assert.doesNotMatch(profile, /계약과 확정 고지 후에만 연결/);
    assert.match(profile, /Didit Identity Spain, S\.L\./);
    assert.match(profile, /Sandbox는 보유기간 1개월/);
    assert.match(factory, /provider: null/);
    assert.match(factory, /classifyIdentityReadiness/);
    assert.doesNotMatch(factory, /if \(!IDENTITY_PROVIDER_NOTICE_READY\) return null/);
    assert.equal(IDENTITY_PROVIDER_NOTICE_READY, true);
    assert.equal(classifyIdentityReadiness({}, IDENTITY_PROVIDER_NOTICE_READY), "ENV_DISABLED");
    assert.equal(classifyIdentityReadiness({ ...env, UNSTANDARD_IDENTITY_ENABLED: "false" }, IDENTITY_PROVIDER_NOTICE_READY), "ENV_DISABLED");
    assert.equal(classifyIdentityReadiness({ ...env, DIDIT_WEBHOOK_SECRET: undefined }, IDENTITY_PROVIDER_NOTICE_READY), "WEBHOOK_NOT_CONFIGURED");
    assert.equal(classifyIdentityReadiness(env, IDENTITY_PROVIDER_NOTICE_READY), "READY");
    const migration = readFileSync("drizzle/migrations/0011_premium_rhodey.sql", "utf8");
    assert.doesNotMatch(migration, /\b(real_name|phone_number|phone|birth_date|ci|di|otp)\b/i);
    assert.doesNotMatch(migration, /UPDATE\s+profiles/i);
  });
});

const env = {
  UNSTANDARD_IDENTITY_ENABLED: "true",
  DIDIT_EXPECTED_ENVIRONMENT: "sandbox",
  DIDIT_API_KEY: "synthetic-test-secret-not-a-credential",
  DIDIT_WORKFLOW_ID: workflowId,
  UNSTANDARD_APP_URL: "https://unstandard.example",
  DIDIT_WEBHOOK_SECRET: "synthetic-webhook-secret",
};
const config = parseDiditIdentityConfig(env)!;

function canonicalDecision(overrides: Record<string, unknown> = {}) {
  return {
    session_id: providerReference,
    session_kind: "user",
    session_number: 42,
    session_url: launch.url,
    status: "Approved",
    environment: "sandbox",
    workflow_id: workflowId,
    features: ["ID_VERIFICATION", "LIVENESS", "FACE_MATCH", "IP_ANALYSIS"],
    vendor_data: requestId,
    metadata: { private_marker: "must-not-cross-adapter" },
    id_verifications: [{ status: "Approved", date_of_birth: "2000-01-01", document_number: "raw-document-number", full_name: "raw-document-name" }],
    liveness_checks: [{ status: "Approved", video_url: "https://media.example/raw-video" }],
    face_matches: [{ status: "Approved", score: 99.9, image_url: "https://media.example/raw-face" }],
    ip_analyses: [{ status: "Approved", ip_address: "192.0.2.1" }],
    ...overrides,
  };
}

describe("Didit V3 canonical adapter (synthetic HTTP only)", () => {
  it("keeps disabled, partial, malformed and control-character config closed", () => {
    assert.equal(parseDiditIdentityConfig({}), null);
    for (const patch of [
      { UNSTANDARD_IDENTITY_ENABLED: "false" }, { UNSTANDARD_IDENTITY_ENABLED: "test" },
      { DIDIT_EXPECTED_ENVIRONMENT: undefined }, { DIDIT_EXPECTED_ENVIRONMENT: "Sandbox" },
      { DIDIT_API_KEY: "" }, { DIDIT_API_KEY: "secret\nAuthorization:bad" },
      { DIDIT_WORKFLOW_ID: "other" }, { UNSTANDARD_APP_URL: "http://unstandard.example" },
    ]) assert.equal(parseDiditIdentityConfig({ ...env, ...patch }), null);
    assert.equal(parseDiditIdentityConfig({ ...env, VERCEL_ENV: "preview", DIDIT_EXPECTED_ENVIRONMENT: "live" }), null);
    assert.equal(parseDiditIdentityConfig({ ...env, VERCEL_ENV: "production", DIDIT_EXPECTED_ENVIRONMENT: "sandbox" }), null);
    assert.equal(parseDiditIdentityConfig({ ...env, VERCEL_ENV: "preview" })?.expectedEnvironment, "sandbox");
    assert.equal(parseDiditIdentityConfig({ ...env, VERCEL_ENV: "production", DIDIT_EXPECTED_ENVIRONMENT: "live" })?.expectedEnvironment, "live");
  });
  it("creates only a server-bound opaque session with no customer payload", async () => {
    let calls = 0;
    const provider = createDiditIdentityProvider(config, async (url, init) => {
      calls++;
      assert.equal(String(url), "https://verification.didit.me/v3/session/");
      assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
      assert.equal(new Headers(init?.headers).get("x-api-key"), env.DIDIT_API_KEY);
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, { workflow_id: workflowId, vendor_data: requestId, callback: "https://unstandard.example/api/identity/return", callback_method: "both", language: "ko" });
      assert.doesNotMatch(JSON.stringify(body), /name|phone|birth|metadata|email/i);
      return Response.json({ session_id: providerReference, url: launch.url, session_token: "must-not-cross-adapter" });
    });
    assert.deepEqual(await provider.start({ requestId }), launch);
    assert.equal(calls, 1);
  });
  it("binds session/request/workflow and returns only minimal proof", async () => {
    const provider = createDiditIdentityProvider(config, async (url, init) => {
      assert.equal(String(url), `https://verification.didit.me/v3/session/${providerReference}/decision/`);
      assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
      assert.equal(new Headers(init?.headers).get("x-api-key"), env.DIDIT_API_KEY);
      assert.equal(init?.body, undefined);
      return Response.json(canonicalDecision());
    }, () => now);
    const result = await provider.verify({ requestId, providerReference });
    assert.deepEqual(result, { requestId, providerReference, verifiedAt: now, documentVerified: true, livenessVerified: true, faceMatchVerified: true, deviceIpVerified: true, adultVerified: true });
    assert.doesNotMatch(JSON.stringify(result), /raw-document|raw-name|raw-video|raw-face|192\.0\.2\.1|private-marker|secret/i);
  });
  it("requires the target workflow's ID, liveness, face-match, IP and adult checks", async () => {
    const bad = [
      { status: "In Review" },
      { environment: "live" },
      { environment: undefined },
      { session_id: "55555555-5555-4555-8555-555555555555" },
      { vendor_data: "stolen" },
      { workflow_id: "55555555-5555-4555-8555-555555555555" },
      { features: ["ID_VERIFICATION", "LIVENESS", "FACE_MATCH"] },
      { id_verifications: [{ status: "Declined", date_of_birth: "2000-01-01" }] },
      { liveness_checks: [{ status: "Declined" }] },
      { face_matches: [{ status: "Declined" }] },
      { ip_analyses: [{ status: "Declined" }] },
      { id_verifications: [{ status: "Approved", date_of_birth: "2010-01-01" }] },
      { id_verifications: [{ status: "Approved", date_of_birth: "2000-02-31" }] },
    ];
    for (const patch of bad) {
      const provider = createDiditIdentityProvider(config, async () => Response.json(canonicalDecision(patch)), () => now);
      assert.equal(await provider.verify({ requestId, providerReference }), null);
    }
  });
  it("purges the Didit session and accepts only explicit deletion outcomes", async () => {
    const provider = createDiditIdentityProvider(config, async (url, init) => {
      assert.equal(String(url), `https://verification.didit.me/v3/session/${providerReference}/delete/`);
      assert.equal(init?.method, "DELETE"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
      assert.deepEqual(JSON.parse(String(init?.body)), { retain_face_embeddings: false, deletion_instruction: "operational_session_delete", instruction_id: requestId });
      assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
      return Response.json({ session_id: providerReference, face_retention_outcome: "deleted", biometric_template_uuid: null });
    });
    assert.equal(await provider.purge({ requestId, providerReference }), true);
    const noTemplate = createDiditIdentityProvider(config, async () => Response.json({ session_id: providerReference, face_retention_outcome: "none", biometric_template_uuid: null }));
    assert.equal(await noTemplate.purge({ requestId, providerReference }), true);
    const legacy204 = createDiditIdentityProvider(config, async () => new Response(null, { status: 204 }));
    assert.equal(await legacy204.purge({ requestId, providerReference }), false);
    const missingTemplate = createDiditIdentityProvider(config, async () => Response.json({ session_id: providerReference, face_retention_outcome: "deleted" }));
    assert.equal(await missingTemplate.purge({ requestId, providerReference }), false);
    for (const outcome of ["retained_with_user", "ineligible_no_vendor_user"]) {
      const p = createDiditIdentityProvider(config, async () => Response.json({ session_id: providerReference, face_retention_outcome: outcome }));
      assert.equal(await p.purge({ requestId, providerReference }), false);
    }
    const missing = createDiditIdentityProvider(config, async () => new Response(null, { status: 404 }));
    assert.equal(await missing.purge({ requestId, providerReference }), true, "Didit defines 404 as already deleted or unknown; a bound session is idempotently absent");
  });
  it("fails closed on malformed, oversized and non-JSON responses", async () => {
    for (const response of [
      Response.json({ message: "synthetic-secret" }, { status: 401 }),
      new Response("synthetic-secret", { headers: { "Content-Type": "text/html" } }),
      new Response("invalid-json", { headers: { "Content-Type": "application/json" } }),
      new Response(`{"session_id":"${providerReference}","url":"https://verify.didit.me/session/${providerReference}","x":"${"x".repeat(40_000)}"}`, { headers: { "Content-Type": "application/json" } }),
    ]) {
      const provider = createDiditIdentityProvider(config, async () => response);
      await assert.rejects(provider.start({ requestId }));
    }
  });
  it("keeps transient canonical decision failures retryable", async () => {
    const provider = createDiditIdentityProvider(config, async () => new Response(null, { status: 503 }));
    await assert.rejects(provider.verify({ requestId, providerReference }));
  });
});

describe("browser identity flow (hosted Didit redirect)", () => {
  function browserFixture() {
    const posts: { action: string; body: unknown }[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      posts.push({ action: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true, requestId, launch });
    };
    return { posts, fetcher };
  }
  it("sends no customer data and navigates only to the server-issued Didit URL", async () => {
    const f = browserFixture(); let navigated = "";
    await startBrowserIdentity({ origin: "https://unstandard.example", consentAccepted: true,
      onStarted: (id) => assert.equal(id, requestId), navigate: (url) => { navigated = url; } }, f.fetcher);
    assert.equal(navigated, launch.url); assert.deepEqual(f.posts.map((p) => p.action), ["/api/identity/start"]);
    assert.deepEqual(f.posts[0].body, { consentAccepted: true, noticeVersion: IDENTITY_NOTICE_VERSION });
  });
  it("blocks missing consent and rejects untrusted origins before API invocation", async () => {
    for (const input of [{ consentAccepted: false, origin: "https://unstandard.example" }, { consentAccepted: true, origin: "http://unstandard.example" }]) {
      const f = browserFixture();
      await assert.rejects(startBrowserIdentity({ ...input, onStarted: () => undefined, navigate: () => undefined }, f.fetcher));
      assert.equal(f.posts.length, 0);
    }
  });
  it("complete retry submits only the server-issued request ID", async () => {
    const f = browserFixture(); await completeBrowserIdentity(requestId, f.fetcher);
    assert.deepEqual(f.posts[0].body, { requestId });
  });
  it("return route strips all query parameters and never grants verification on GET", () => {
    const response = identityReturn();
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), "/profile-setup");
    assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  });
});

describe("Didit webhook boundary", () => {
  const webhook = { event_id: "66666666-6666-4666-8666-666666666666", webhook_type: "status.updated", timestamp: 1_777_000_000, session_id: providerReference, session_kind: "user", workflow_id: workflowId, vendor_data: requestId, status: "Approved", environment: "sandbox", decision: { raw: "untrusted" }, name: "Unicode 이름" };
  it("accepts a signed Sandbox webhook and rejects a Live or missing environment before scheduling", () => {
    const signatureFor = (payload: unknown) => createHmac("sha256", env.DIDIT_WEBHOOK_SECRET)
      .update(canonicalizeDiditWebhook(payload), "utf8").digest("hex");
    const sandbox = diditSessionWebhookSchema.safeParse(webhook);
    assert.equal(sandbox.success, true);
    const sandboxSignature = signatureFor(webhook);
    assert.equal(matchesExpectedDiditEnvironment(webhook.environment, "sandbox") && verifyDiditWebhookSignature({ payload: webhook, signature: sandboxSignature, timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), true);
    assert.equal(diditWebhookSignatureAllowed({ expectedEnvironment: "sandbox", bodyBoundSignatureVerified: true, simpleSignatureVerified: false }), true);
    assert.equal(diditWebhookSignatureAllowed({ expectedEnvironment: "sandbox", bodyBoundSignatureVerified: false, simpleSignatureVerified: true }), false);
    assert.equal(verifyDiditWebhookSignature({ payload: webhook, signature: "0".repeat(64), timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);

    const live = { ...webhook, environment: "live" };
    const liveSignature = signatureFor(live);
    assert.equal(diditSessionWebhookSchema.safeParse(live).success, true);
    assert.equal(verifyDiditWebhookSignature({ payload: live, signature: liveSignature, timestamp: String(live.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: live.timestamp }), true);
    assert.equal(matchesExpectedDiditEnvironment(live.environment, "sandbox"), false);
    const missingEnvironment = { ...webhook } as Record<string, unknown>;
    delete missingEnvironment.environment;
    assert.equal(diditSessionWebhookSchema.safeParse(missingEnvironment).success, false);

    const route = readFileSync("app/api/identity/webhook/route.ts", "utf8");
    const environmentGate = route.indexOf("matchesExpectedDiditEnvironment");
    const requestLookup = route.indexOf("findByProviderReference");
    const scheduling = route.indexOf("markCompletionRequested");
    assert.ok(environmentGate >= 0 && environmentGate < requestLookup && requestLookup < scheduling);
  });
  it("verifies V2 sorted Unicode-preserving signatures and rejects stale/tampered values", () => {
    const signature = createHmac("sha256", env.DIDIT_WEBHOOK_SECRET).update(canonicalizeDiditWebhook(webhook), "utf8").digest("hex");
    assert.equal(verifyDiditWebhookSignature({ payload: webhook, signature, timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), true);
    assert.equal(verifyDiditWebhookSignature({ payload: { ...webhook, status: "Declined" }, signature, timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);
    assert.equal(verifyDiditWebhookSignature({ payload: webhook, signature, timestamp: String(webhook.timestamp - 301), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);
    assert.equal(verifyDiditWebhookSignature({ payload: webhook, signature: "short", timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);
  });
  it("verifies Didit's raw-body signature fallback", () => {
    const rawBody = new TextEncoder().encode(JSON.stringify(webhook));
    const signature = createHmac("sha256", env.DIDIT_WEBHOOK_SECRET).update(rawBody).digest("hex");
    assert.equal(verifyDiditWebhookRawSignature({ rawBody, signature, timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), true);
    assert.equal(verifyDiditWebhookRawSignature({ rawBody: new TextEncoder().encode(JSON.stringify({ ...webhook, status: "Declined" })), signature, timestamp: String(webhook.timestamp), secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);
  });
  it("accepts the documented simple envelope signature only for canonical re-fetch", () => {
    const timestamp = String(webhook.timestamp);
    const signature = createHmac("sha256", env.DIDIT_WEBHOOK_SECRET)
      .update(`${timestamp}:${webhook.session_id}:${webhook.status}:${webhook.webhook_type}`, "utf8")
      .digest("hex");
    assert.equal(verifyDiditWebhookSimpleSignature({ timestamp, sessionId: webhook.session_id, status: webhook.status, webhookType: webhook.webhook_type, signature, secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), true);
    assert.equal(verifyDiditWebhookSimpleSignature({ timestamp, sessionId: webhook.session_id, status: "Declined", webhookType: webhook.webhook_type, signature, secret: env.DIDIT_WEBHOOK_SECRET, nowSeconds: webhook.timestamp }), false);
  });
  it("keeps the webhook endpoint fail-closed unless full runtime readiness is satisfied", () => {
    const route = readFileSync("app/api/identity/webhook/route.ts", "utf8");
    assert.match(route, /getIdentityReadiness/);
    assert.match(route, /if \(!readiness\.available \|\| !config\?\.webhookSecret\)/);
    assert.match(route, /status: 404/);
    assert.equal(IDENTITY_PROVIDER_NOTICE_READY, true);
    assert.equal(classifyIdentityReadiness({}, IDENTITY_PROVIDER_NOTICE_READY), "ENV_DISABLED");
    assert.equal(classifyIdentityReadiness(env, IDENTITY_PROVIDER_NOTICE_READY), "READY");
  });
  it("durably schedules canonical completion before acknowledgement and keeps storage failures retryable", () => {
    const route = readFileSync("app/api/identity/webhook/route.ts", "utf8");
    assert.equal(route.includes('from "next/server"'), true);
    assert.equal(route.includes("after("), true);
    assert.ok(route.indexOf("markCompletionRequested") < route.lastIndexOf("after("));
    assert.equal(route.includes("await createIdentityService().complete"), true);
    assert.equal(route.includes("markCompletionRequested"), true);
    assert.equal(route.includes("RECONCILIATION_SCHEDULED"), true);
    assert.equal(route.includes("status: 503"), true);
  });

  it("uses privacy erasure for user-requested profile withdrawal", () => {
    const service = readFileSync("lib/server/profile/profile-basics.service.ts", "utf8");
    assert.match(service, /deletionInstruction: "privacy_erasure"/);
  });
});

describe("identity webhook reconciliation", () => {
  it("retries a durable completion after a transient canonical failure without duplicate verification or purge", async () => {
    const f = fixture();
    let attempts = 0;
    f.provider.verify = async () => {
      if (++attempts === 1) throw new Error("synthetic canonical 503");
      return f.proof;
    };
    await f.repo.markCompletionRequested(request, "77777777-7777-4777-8777-777777777777", now);
    const input = { repository: f.repo, service: identityService(f.deps), limit: 1 };
    assert.deepEqual(await reconcileIdentityCompletions(input), { selected: 1, verified: 0, retryable: 1, cleared: 0 });
    assert.equal((await f.repo.listCompletionRequests(1)).length, 1);
    assert.equal(f.unpurged(), 0);
    assert.equal(f.purged(), 0);
    assert.deepEqual(await reconcileIdentityCompletions(input), { selected: 1, verified: 1, retryable: 0, cleared: 0 });
    await reconcileIdentityCompletions(input);
    assert.equal(attempts, 2);
    assert.equal(f.unpurged(), 1);
    assert.equal(f.purged(), 1);
  });
  it("processes a bounded durable request sequentially and clears terminal non-approvals", async () => {
    const f = fixture();
    await f.repo.markCompletionRequested(request, "77777777-7777-4777-8777-777777777777", now);
    const first = await reconcileIdentityCompletions({ repository: f.repo, service: identityService(f.deps), limit: 1 });
    assert.deepEqual(first, { selected: 1, verified: 1, retryable: 0, cleared: 0 });

    const rejected = fixture();
    await rejected.repo.markCompletionRequested(request, "88888888-8888-4888-8888-888888888888", now);
    rejected.provider.verify = async () => null;
    const second = await reconcileIdentityCompletions({ repository: rejected.repo, service: identityService(rejected.deps), limit: 1 });
    assert.deepEqual(second, { selected: 1, verified: 0, retryable: 0, cleared: 1 });
    assert.deepEqual(await rejected.repo.listCompletionRequests(1), []);
  });

  it("retries unpurged and expired provider sessions without requiring another browser callback", async () => {
    const unpurged = fixture();
    unpurged.provider.purge = async () => true;
    await unpurged.repo.markVerifiedUnpurged(request, unpurged.proof, now);
    const first = await reconcileIdentityCompletions({ repository: unpurged.repo, service: identityService(unpurged.deps) });
    assert.deepEqual(first, { selected: 1, verified: 1, retryable: 0, cleared: 0 });

    const originalExpiry = request.expiresAt;
    request.expiresAt = new Date(now.getTime() - 1);
    const expired = fixture();
    try {
      const second = await reconcileIdentityCompletions({ repository: expired.repo, service: identityService(expired.deps) });
      assert.deepEqual(second, { selected: 1, verified: 0, retryable: 0, cleared: 1 });
      assert.equal(expired.calls(), 1);
    } finally {
      request.expiresAt = originalExpiry;
    }
  });
});
