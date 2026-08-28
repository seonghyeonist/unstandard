import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileBasicsForm } from "../components/profile/profile-basics-form";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canIntroduce, isIntroductionEligible, profileBasicsSchema, PROFILE_CONSENT_VERSION, INTRODUCTION_SCOPE_VERSION, type EligibilityFacts } from "../lib/profile/basics";
import { isSameOriginMutation, readSmallJson } from "../lib/http/profile-request";

const now = new Date("2026-08-28T00:00:00Z");
const facts: EligibilityFacts = { gender: "male", age: 22, region: "서울", profileConsentVersion: PROFILE_CONSENT_VERSION,
  introductionScopeVersion: INTRODUCTION_SCOPE_VERSION, introductionScopeAccepted: true, updatedAt: now,
  identityNoticeVersion: "alpha-identity-v1", onboarded: true, revision: "revision-1", verifiedRevision: "revision-1", verifiedAt: now };
const input = { nickname: "여름", gender: "male", age: 22, region: "서울", introductionScopeAccepted: true,
  profileConsentAccepted: true, profileConsentVersion: PROFILE_CONSENT_VERSION, introductionScopeVersion: INTRODUCTION_SCOPE_VERSION };

describe("basic profile consent and eligibility", () => {
  it("accepts minimal adult profile without name, phone, birthdate or exact address", () => {
    assert.equal(profileBasicsSchema.parse(input).age, 22);
    assert.equal(profileBasicsSchema.parse({ ...input, introductionScopeAccepted: false }).introductionScopeAccepted, false);
  });
  for (const patch of [{ age: 18 }, { age: 22.2 }, { age: "22" }, { age: 121 }, { gender: "" }, { region: "철산동 1번지" },
    { profileConsentAccepted: false }, { profileConsentVersion: "old" }, { introductionScopeVersion: "old" },
    { realName: "synthetic" }, { phone: "000" }, { verified: true }, { userId: "another-user" }]) {
    it(`rejects invalid or unsolicited fields ${JSON.stringify(patch)}`, () => assert.equal(profileBasicsSchema.safeParse({ ...input, ...patch }).success, false));
  }
  it("requires both eligible, different genders", () => {
    assert.equal(canIntroduce(facts, { ...facts, gender: "female" }, now), true);
    assert.equal(canIntroduce(facts, facts, now), false);
  });
  for (const patch of [{ identityNoticeVersion: "old" }, { gender: null }, { age: null }, { region: null }, { introductionScopeAccepted: false },
    { verifiedAt: null }, { verifiedRevision: "old" }, { onboarded: false }, { updatedAt: new Date("2025-08-28T00:00:00Z") },
    { verifiedAt: new Date("2030-01-01") }, { profileConsentVersion: "old" }, { introductionScopeVersion: "old" }]) {
    it(`fails closed for incomplete/stale facts ${JSON.stringify(patch)}`, () => {
      assert.equal(isIntroductionEligible({ ...facts, ...patch }, now), false);
      assert.equal(canIntroduce({ ...facts, ...patch }, { ...facts, gender: "female" }, now), false);
    });
  }
});
describe("profile request privacy", () => {
  it("rejects cross-site and missing origin mutations", () => {
    assert.equal(isSameOriginMutation(new Request("https://unstandard.app/api/profile/basics")), false);
    assert.equal(isSameOriginMutation(new Request("https://unstandard.app/api/profile/basics", { headers: { origin: "https://evil.example" } })), false);
    assert.equal(isSameOriginMutation(new Request("https://unstandard.app/api/profile/basics", { headers: { origin: "https://unstandard.app" } })), true);
  });
  it("bounds actual bytes even without Content-Length", async () => {
    const make = (body: string) => new Request("https://unstandard.app", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.deepEqual(await readSmallJson(make('{"ok":true}')), { ok: true });
    await assert.rejects(readSmallJson(make(JSON.stringify({ nickname: "가".repeat(1000) }))), /Invalid body/);
    await assert.rejects(readSmallJson(make("not json")));
  });
});

describe("basic profile server-rendered form", () => {
  it("renders gender, age and region but collects no raw identity before provider connection", async () => {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(ProfileBasicsForm, { setup: { basics: null, eligible: false, verification: "not_started", verificationAvailable: false } })));
    assert.match(html, /성별/); assert.match(html, /만 나이/); assert.match(html, /시도 선택/);
    assert.match(html, /인증 서비스 준비 중/);
    assert.match(html, /disabled=""[^>]*>실명·휴대전화 인증 시작/);
    assert.doesNotMatch(html, /type="tel"|name="realName"|name="phone"/);
    assert.match(html, /지원·계정 삭제/);
  });
  it("offers result recovery from the authenticated pending request without rendering its ID or personal input fields", () => {
    const pendingIdentityRequestId = "11111111-1111-4111-8111-111111111111";
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(ProfileBasicsForm, { setup: { basics: null, eligible: false, verification: "pending",
        verificationAvailable: true, pendingIdentityRequestId } })));
    assert.match(html, /인증 결과 확인/); assert.match(html, /확인 대기/);
    assert.doesNotMatch(html, new RegExp(pendingIdentityRequestId));
    assert.doesNotMatch(html, /type="tel"|name="realName"|name="phone"/);
  });
});
