import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDiditIdentityPurgeProvider } from "../lib/identity/didit";
import { reconcileIdentityProviderPurges } from "../lib/identity/reconciliation";

describe("identity provider purge outbox reconciliation", () => {
  it("uses a deletion-only Didit client without enabling collection", async () => {
    let requestUrl = "";
    let requestMethod = "";
    let requestBody = "";
    const provider = createDiditIdentityPurgeProvider(
      "synthetic-test-api-key",
      async (input, init) => {
        requestUrl = String(input);
        requestMethod = init?.method ?? "";
        requestBody = String(init?.body ?? "");
        return new Response(null, { status: 404 });
      },
    );

    assert.equal("start" in provider, false);
    assert.equal("verify" in provider, false);
    assert.equal(await provider.purge({
      requestId: "123e4567-e89b-42d3-a456-426614174000",
      providerReference: "123e4567-e89b-42d3-a456-426614174001",
      deletionInstruction: "privacy_erasure",
    }), true);
    assert.match(requestUrl, /123e4567-e89b-42d3-a456-426614174001\/delete\/$/);
    assert.equal(requestMethod, "DELETE");
    assert.deepEqual(JSON.parse(requestBody), {
      retain_face_embeddings: false,
      deletion_instruction: "privacy_erasure",
      instruction_id: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("removes only rows after the deletion-only provider confirms erasure", async () => {
    const entries = [
      {
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        provider: "didit-v3",
        providerReference: "123e4567-e89b-42d3-a456-426614174001",
      },
      {
        requestId: "123e4567-e89b-42d3-a456-426614174002",
        provider: "didit-v3",
        providerReference: "123e4567-e89b-42d3-a456-426614174003",
      },
    ];
    const deleted: string[] = [];
    const retried: string[] = [];
    const result = await reconcileIdentityProviderPurges({
      repository: {
        async listProviderPurges(limit) { return entries.slice(0, limit); },
        async deleteProviderPurge(entry) { deleted.push(entry.requestId); return true; },
        async markProviderPurgeRetry(entry) { retried.push(entry.requestId); },
      },
      provider: {
        id: "didit-v3",
        async purge({ requestId }) { return requestId === entries[0].requestId; },
      },
      limit: 10,
    });

    assert.deepEqual(result, { selected: 2, purged: 1, retryable: 1 });
    assert.deepEqual(deleted, [entries[0].requestId]);
    assert.deepEqual(retried, [entries[1].requestId]);
  });

  it("keeps unknown provider records queued", async () => {
    let deleteCalls = 0;
    const result = await reconcileIdentityProviderPurges({
      repository: {
        async listProviderPurges() {
          return [{
            requestId: "123e4567-e89b-42d3-a456-426614174004",
            provider: "unknown-provider",
            providerReference: "123e4567-e89b-42d3-a456-426614174005",
          }];
        },
        async deleteProviderPurge() { deleteCalls++; return true; },
        async markProviderPurgeRetry() {},
      },
      provider: { id: "didit-v3", async purge() { return true; } },
    });

    assert.deepEqual(result, { selected: 1, purged: 0, retryable: 1 });
    assert.equal(deleteCalls, 0);
  });
});
