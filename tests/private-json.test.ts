import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIVATE_NO_STORE_CACHE_CONTROL,
  applyPrivateNoStoreHeaders,
  assertPrivateNoStoreCacheControl,
  cacheControlAllowsPublic,
  privateJson,
  withVaryCookie,
} from "../lib/http/private-json";

describe("privateJson / private no-store contract", () => {
  it("sets private no-store headers on JSON responses", () => {
    const response = privateJson({ user: null }, { status: 401 });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), PRIVATE_NO_STORE_CACHE_CONTROL);
    assert.equal(response.headers.get("Pragma"), "no-cache");
    assert.equal(response.headers.get("Expires"), "0");
    assert.equal(response.headers.get("Vary"), "Cookie");
  });

  it("rejects public Cache-Control", () => {
    assert.equal(cacheControlAllowsPublic("public, max-age=0, must-revalidate"), true);
    assert.equal(cacheControlAllowsPublic(PRIVATE_NO_STORE_CACHE_CONTROL), false);
    const failures = assertPrivateNoStoreCacheControl("public, max-age=0, must-revalidate");
    assert.ok(failures.some((f) => f.includes("public")));
    assert.ok(failures.some((f) => f.includes("private")));
  });

  it("requires private and no-store", () => {
    assert.deepEqual(assertPrivateNoStoreCacheControl(PRIVATE_NO_STORE_CACHE_CONTROL), []);
    assert.ok(assertPrivateNoStoreCacheControl("no-store").some((f) => f.includes("private")));
    assert.ok(assertPrivateNoStoreCacheControl("private").some((f) => f.includes("no-store")));
    assert.ok(assertPrivateNoStoreCacheControl(null).some((f) => f.includes("missing")));
  });

  it("appends Cookie to Vary without destroying existing values", () => {
    const headers = new Headers({ Vary: "Accept-Encoding, Authorization" });
    withVaryCookie(headers);
    assert.equal(headers.get("Vary"), "Accept-Encoding, Authorization, Cookie");

    withVaryCookie(headers);
    assert.equal(headers.get("Vary"), "Accept-Encoding, Authorization, Cookie");
  });

  it("applyPrivateNoStoreHeaders overwrites Cache-Control to private no-store", () => {
    const headers = new Headers({
      "Cache-Control": "public, max-age=0, must-revalidate",
      Vary: "Accept",
    });
    applyPrivateNoStoreHeaders(headers);
    assert.equal(headers.get("Cache-Control"), PRIVATE_NO_STORE_CACHE_CONTROL);
    assert.ok(!cacheControlAllowsPublic(headers.get("Cache-Control")));
    assert.equal(headers.get("Vary"), "Accept, Cookie");
  });
});
