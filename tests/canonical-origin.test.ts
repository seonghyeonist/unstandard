import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCanonicalAuthOrigin,
  normalizeWebOrigin,
} from "../lib/auth/canonical-origin.ts";

describe("canonical auth origin", () => {
  it("keeps an explicit matching canonical pair authoritative", () => {
    assert.equal(
      getCanonicalAuthOrigin({
        BETTER_AUTH_URL: "https://alpha.example.com/",
        UNSTANDARD_APP_URL: "https://alpha.example.com",
      }),
      "https://alpha.example.com",
    );
  });

  it("rejects mismatched explicit canonical origins", () => {
    assert.throws(
      () =>
        getCanonicalAuthOrigin({
          BETTER_AUTH_URL: "https://auth.example.com",
          UNSTANDARD_APP_URL: "https://app.example.com",
        }),
      /AUTH_CANONICAL_ORIGIN_MISMATCH/,
    );
  });

  it("uses the stable Vercel branch URL only for Preview when explicit config is incomplete", () => {
    assert.equal(
      getCanonicalAuthOrigin({
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "unstandard-git-feature.example.vercel.app",
        VERCEL_URL: "unstandard-random.example.vercel.app",
        BETTER_AUTH_URL: "https://stale-or-partial.example.com",
      }),
      "https://unstandard-git-feature.example.vercel.app",
    );
  });

  it("falls back to the unique Vercel deployment URL when no branch URL is exposed", () => {
    assert.equal(
      getCanonicalAuthOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "unstandard-random.example.vercel.app",
      }),
      "https://unstandard-random.example.vercel.app",
    );
  });

  it("remains fail-closed outside Preview", () => {
    assert.throws(
      () => getCanonicalAuthOrigin({ VERCEL_ENV: "production" }),
      /AUTH_CANONICAL_ORIGIN_UNAVAILABLE/,
    );
    assert.throws(
      () => getCanonicalAuthOrigin({ NODE_ENV: "production" }),
      /AUTH_CANONICAL_ORIGIN_UNAVAILABLE/,
    );
  });

  it("accepts HTTPS and localhost HTTP but rejects insecure public origins", () => {
    assert.equal(normalizeWebOrigin("https://example.com/path"), "https://example.com");
    assert.equal(normalizeWebOrigin("http://localhost:3000/path"), "http://localhost:3000");
    assert.equal(normalizeWebOrigin("http://example.com"), null);
  });
});
