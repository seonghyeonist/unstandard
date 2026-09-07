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

  it("removes the fragment and hides implementation fields from OAuth signup UI", () => {
    const register = source("components/auth/register-form.tsx");
    assert.match(register, /window\.history\.replaceState/);
    assert.match(register, /\/api\/alpha\/invite\/prepare/);
    assert.match(register, /\/api\/alpha\/invite\/claim/);
    assert.doesNotMatch(register, /Invite code|placeholder="Email"|new-password|닉네임 \(실명 입력 금지\)/);
    assert.doesNotMatch(register, /signUpWithEmailPassword/);
  });

  it("renders a concrete fail-closed account linking recovery message", () => {
    const login = source("app/login/login-client.tsx");
    assert.match(login, /account_not_linked/);
    assert.match(login, /자동 연결되지 않았어요/);
  });
});
