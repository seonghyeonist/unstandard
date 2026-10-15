import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  createPreparedInviteTicket,
  signPreparedInviteTicket,
  verifyPreparedInviteTicket,
} from "../lib/auth/invite-ticket";

const source = (path: string) => readFileSync(path, "utf8");

describe("fragment invite registration state", () => {
  it("signs short-lived prepared state without retaining a raw invite capability", () => {
    const ticket = createPreparedInviteTicket("invite-id", "member@example.com", "test-secret");
    assert.deepEqual(verifyPreparedInviteTicket(ticket.token, "test-secret"), {
      inviteId: "invite-id",
      email: "member@example.com",
      exp: verifyPreparedInviteTicket(ticket.token, "test-secret")?.exp,
    });
    assert.equal(verifyPreparedInviteTicket(`${ticket.token}x`, "test-secret"), null);
    const expired = signPreparedInviteTicket({ inviteId: "invite-id", email: "member@example.com", exp: 1 }, "test-secret");
    assert.equal(verifyPreparedInviteTicket(expired, "test-secret"), null);
  });

  it("keeps capability validation separate from legal-consent reservation", () => {
    const prepare = source("app/api/alpha/invite/prepare/route.ts");
    const claim = source("app/api/alpha/invite/claim/route.ts");
    assert.match(prepare, /prepareInviteForRegistration/);
    assert.doesNotMatch(prepare, /reservePreparedInvite/);
    assert.match(claim, /reservePreparedInvite/);
    assert.match(claim, /parseRegistrationLegalSelection/);
    assert.doesNotMatch(claim, /input\.code|input\.email/);
  });

  it("removes the fragment and keeps implementation fields out of direct signup UI", () => {
    const register = source("components/auth/register-form.tsx");
    assert.match(register, /window\.history\.replaceState/);
    assert.match(register, /\/api\/alpha\/invite\/prepare/);
    assert.match(register, /\/api\/alpha\/invite\/claim/);
    assert.match(register, /new-password/);
    assert.match(register, /이메일 인증 코드/);
    assert.doesNotMatch(register, /Google|Naver|OAuth|signIn\.social|signIn\.oauth2/);
  });

  it("renders direct login and password recovery entrypoints", () => {
    const login = source("app/login/login-client.tsx");
    assert.match(login, /비밀번호 재설정/);
    assert.match(login, /초대 링크로 가입/);
    assert.doesNotMatch(login, /Google|Naver|OAuth/);
  });
});
