import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  canonicalBrowserLocation,
  expectedOAuthStateCookieName,
  getCanonicalAuthOrigin,
} from "../lib/auth/canonical-origin";
import {
  getOAuthRequestDiagnostics,
  sanitizeSetCookie,
} from "../lib/auth/oauth-boundary-diagnostics";

const canonicalEnv = {
  BETTER_AUTH_URL: "https://preview.example.com",
  UNSTANDARD_APP_URL: "https://preview.example.com",
};

describe("OAuth canonical-origin boundary", () => {
  it("requires the OAuth base and application origins to be identical", () => {
    assert.equal(getCanonicalAuthOrigin(canonicalEnv), "https://preview.example.com");
    assert.throws(() => getCanonicalAuthOrigin({
      BETTER_AUTH_URL: "https://preview.example.com",
      UNSTANDARD_APP_URL: "https://other-preview.example.com",
    }), /AUTH_CANONICAL_ORIGIN_MISMATCH/);
  });

  it("preserves a fragment invite while returning deployment URLs to the canonical host", () => {
    assert.equal(canonicalBrowserLocation("https://preview.example.com", {
      pathname: "/register", search: "", hash: "#invite=opaque",
    }), "https://preview.example.com/register#invite=opaque");
  });

  it("uses Better Auth's secure, host-only OAuth state cookie contract", () => {
    assert.equal(expectedOAuthStateCookieName("https://preview.example.com"), "__Secure-better-auth.state");
    const diagnostics = getOAuthRequestDiagnostics(new Request("https://preview.example.com/api/auth/callback/google", {
      headers: { cookie: "__Secure-better-auth.state=opaque-state; ordinary=value" },
    }), canonicalEnv);
    assert.equal(diagnostics.stateCookiePresent, true);
    assert.doesNotMatch(JSON.stringify(diagnostics), /opaque-state|ordinary=value/);
  });

  it("records only state-cookie attributes, never its value", () => {
    const cookie = sanitizeSetCookie("__Secure-better-auth.state=opaque-state; Path=/; SameSite=Lax; Secure; HttpOnly");
    assert.deepEqual(cookie, {
      name: "__Secure-better-auth.state", domain: null, path: "/", sameSite: "Lax", secure: true, httpOnly: true,
    });
    assert.doesNotMatch(JSON.stringify(cookie), /opaque-state/);
  });

  it("forces invite issuance, registration, login, and auth trust to the same origin", () => {
    const inviteRoute = readFileSync("app/api/alpha/operator/invites/route.ts", "utf8");
    const reissueRoute = readFileSync("app/api/alpha/operator/invites/[inviteId]/reissue/route.ts", "utf8");
    const auth = readFileSync("lib/auth/auth.ts", "utf8");
    const register = readFileSync("components/auth/register-form.tsx", "utf8");
    const login = readFileSync("app/login/login-client.tsx", "utf8");
    assert.match(inviteRoute, /buildInviteLink\(created\.rawCode\)/);
    assert.doesNotMatch(inviteRoute, /new URL\(request\.url\)\.origin/);
    assert.match(reissueRoute, /buildInviteLink\(created\.rawCode\)/);
    assert.doesNotMatch(reissueRoute, /new URL\(request\.url\)\.origin/);
    assert.match(auth, /baseURL: getCanonicalAuthOrigin\(\)/);
    assert.match(auth, /return \[getCanonicalAuthOrigin\(\)\]/);
    assert.doesNotMatch(auth, /skipStateCookieCheck:\s*true/);
    assert.match(register, /window\.location\.replace\(canonicalBrowserLocation/);
    assert.match(login, /window\.location\.replace\(canonicalBrowserLocation/);
  });
});
