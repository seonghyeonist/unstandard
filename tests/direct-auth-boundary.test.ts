import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

describe("closed-alpha direct-auth boundary", () => {
  it("keeps all account creation behind invite, email proof and legal finalization", () => {
    const auth = source("lib/auth/auth.ts");
    const claim = source("app/api/alpha/invite/claim/route.ts");
    const finalization = source("lib/auth/invite-finalization.ts");
    assert.match(auth, /transaction:\s*true/);
    assert.match(auth, /emailVerified:\s*true/);
    assert.match(auth, /isEmailVerificationTicketUsable/);
    assert.match(auth, /verifyInviteReservation/);
    assert.match(auth, /finalizeInviteRegistration/);
    assert.match(claim, /verifyEmailVerificationTicket/);
    assert.match(claim, /isEmailVerificationTicketUsable/);
    assert.match(claim, /createRegistrationTicket\([\s\S]*proof\.challengeId/);
    assert.doesNotMatch(claim, /input\.email|input\.code/);
    assert.match(finalization, /consumeEmailVerificationProof/);
    assert.match(finalization, /legalAcceptances/);
    assert.match(finalization, /consumeReservedInvite/);
  });

  it("removes provider UI/config while preserving the accounts table", () => {
    const auth = source("lib/auth/auth.ts");
    const client = source("lib/auth/client.ts");
    const register = source("components/auth/register-form.tsx");
    const login = source("app/login/login-client.tsx");
    const env = source(".env.example");
    assert.doesNotMatch(auth, /socialProviders|genericOAuth|GOOGLE|NAVER|google|naver/i);
    assert.doesNotMatch(client, /OAuth|social/);
    assert.doesNotMatch(register, /Google|Naver|OAuth|signIn\.social|signIn\.oauth2/);
    assert.doesNotMatch(login, /Google|Naver|OAuth|signIn\.social|signIn\.oauth2/);
    assert.doesNotMatch(env, /GOOGLE_CLIENT|NAVER_CLIENT/);
    assert.match(source("lib/db/schema/auth.ts"), /export const accounts/);
  });

  it("keeps reset delivery generic and revokes sessions after a successful reset", () => {
    const auth = source("lib/auth/auth.ts");
    const reset = source("components/auth/reset-password-form.tsx");
    assert.match(auth, /sendResetPassword/);
    assert.match(auth, /revokeSessionsOnPasswordReset:\s*true/);
    assert.match(auth, /password_reset_delivery_failed/);
    assert.match(reset, /requestPasswordReset/);
    assert.match(reset, /resetPassword/);
    assert.match(reset, /replaceState/);
  });

  it("hard-disables the legacy OAuth boundary instead of routing into auth", () => {
    const route = source("app/api/auth/[...all]/route.ts");
    assert.match(route, /sign-in\/social/);
    assert.match(route, /sign-in\/oauth2/);
    assert.match(route, /callback.*google.*naver/);
    assert.match(route, /status: 404/);
    assert.doesNotMatch(route, /oauth_boundary|oauth-boundary-diagnostics/);
  });

  it("models pre-account challenges with attempts, expiry and one-time proof state", () => {
    const schema = source("lib/db/schema/email-verification.ts");
    const crypto = source("lib/auth/email-verification-crypto.ts");
    const send = source("app/api/alpha/invite/email/send/route.ts");
    const verify = source("app/api/alpha/invite/email/verify/route.ts");
    assert.match(schema, /codeHash/);
    assert.match(schema, /attemptCount/);
    assert.match(schema, /verifiedAt/);
    assert.match(schema, /consumedAt/);
    assert.match(schema, /invalidatedAt/);
    assert.match(crypto, /createHmac/);
    assert.match(send, /inviteEmailSend/);
    assert.match(verify, /inviteEmailVerify/);
    assert.doesNotMatch(send, /console\.log\([^)]*code/);
    assert.doesNotMatch(verify, /privateJson\(\{[^}]*\bcode\s*:/);
  });
});
