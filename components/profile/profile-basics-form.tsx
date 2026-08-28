"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-field";
import { ACTIVITY_REGIONS, PROFILE_CONSENT_VERSION, INTRODUCTION_SCOPE_VERSION, type ProfileSetupView } from "@/lib/profile/basics";
import { completeBrowserIdentity, startBrowserIdentity } from "@/lib/identity/browser-flow";

async function readSetup(): Promise<ProfileSetupView> {
  const response = await fetch("/api/profile/basics", { cache: "no-store" });
  if (!response.ok) throw new Error("프로필을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return response.json();
}
export function ProfileSetup() {
  const query = useQuery({ queryKey: ["profile-setup"], queryFn: readSetup });
  if (query.isLoading) return <p role="status">프로필을 불러오는 중이에요.</p>;
  if (!query.data || query.isError) return <Card><p role="alert">프로필을 불러오지 못했어요.</p><Button onClick={() => query.refetch()}>다시 시도</Button></Card>;
  return <ProfileBasicsForm key={query.data.basics?.updatedAt ?? "new"} setup={query.data} />;
}
export function ProfileBasicsForm({ setup }: { setup: ProfileSetupView }) {
  const client = useQueryClient();
  const [nickname, setNickname] = useState(setup.basics?.nickname ?? "");
  const [gender, setGender] = useState(setup.basics?.gender ?? "");
  const [age, setAge] = useState(String(setup.basics?.age ?? ""));
  const [region, setRegion] = useState(setup.basics?.region ?? "");
  const [scope, setScope] = useState(setup.basics?.introductionScopeAccepted ?? false);
  const [consent, setConsent] = useState(false);
  const [identityConsent, setIdentityConsent] = useState(false);
  const [startedRequestId, setStartedRequestId] = useState<string>();
  const identityRequest = startedRequestId ?? setup.pendingIdentityRequestId;
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["profile-setup"] });
    await client.invalidateQueries({ queryKey: ["current-user"] });
    // Previously viewed profiles/conversations must not survive a privacy or eligibility change.
    client.removeQueries({ predicate: (q) => !["profile-setup", "current-user"].includes(String(q.queryKey[0])) });
  }
  const save = useMutation({ mutationFn: async () => {
    const response = await fetch("/api/profile/basics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      nickname, gender, age: Number(age), region, introductionScopeAccepted: scope, profileConsentAccepted: consent,
      profileConsentVersion: PROFILE_CONSENT_VERSION, introductionScopeVersion: INTRODUCTION_SCOPE_VERSION,
    }) });
    if (!response.ok) throw new Error(response.status === 429 ? "저장 요청이 많아요. 잠시 뒤 다시 시도해 주세요." : "입력 항목과 동의를 확인해 주세요. 저장되지 않았어요.");
  }, onSuccess: refresh });
  const withdraw = useMutation({ mutationFn: async () => {
    const response = await fetch("/api/profile/basics", { method: "DELETE" });
    if (!response.ok) throw new Error("철회를 완료하지 못했어요. 다시 시도해 주세요.");
  }, onSuccess: refresh });
  const verify = useMutation({ mutationFn: async (action: "start" | "complete") => {
    if (action === "complete") {
      await completeBrowserIdentity(identityRequest ?? "");
    } else {
      // SDK loader is not imported until the configured service is available and the user consents.
      if (!setup.verificationAvailable || !identityConsent) throw new Error("인증 안내를 확인해 주세요.");
      let sdk;
      try { sdk = await import("@portone/browser-sdk/v2"); }
      catch { throw new Error("인증 화면을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."); }
      await startBrowserIdentity({ consentAccepted: identityConsent, origin: window.location.origin,
        sdk: sdk.requestIdentityVerification, onStarted: setStartedRequestId });
    }
    setStartedRequestId(undefined);
  }, onSettled: refresh });
  const busy = save.isPending || withdraw.isPending || verify.isPending;
  return <div className="space-y-5">
    <Card>
      <h2 className="text-xl font-black">기본 프로필</h2>
      <p className="mt-3 text-sm leading-6 text-foreground/70">닉네임·성별·입력 시점의 만 나이·시도 단위 활동 지역을 사용해요. 상세 주소·학교·직장은 받지 않아요. 나이와 성별은 본인이 입력한 정보이며 본인인증만으로 검증됐다는 뜻은 아니에요.</p>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="block text-sm font-semibold">닉네임<TextInput className="mt-2" required maxLength={16} autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} /></label>
        <label className="block text-sm font-semibold">성별<select className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3" required value={gender} onChange={(e) => setGender(e.target.value)}><option value="">선택해 주세요</option><option value="male">남성</option><option value="female">여성</option></select></label>
        <label className="block text-sm font-semibold">만 나이<TextInput className="mt-2" required type="number" min={19} max={120} step={1} value={age} onChange={(e) => setAge(e.target.value)} /></label>
        <label className="block text-sm font-semibold">활동 지역<select className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3" required value={region} onChange={(e) => setRegion(e.target.value)}><option value="">시도 선택</option>{ACTIVITY_REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="flex gap-3 text-sm leading-6"><input type="checkbox" checked={scope} onChange={(e) => setScope(e.target.checked)} className="mt-1" /><span>이번 알파는 남성과 여성 간 소개만 제공함을 확인했고, 이 범위의 소개를 원해요. 성적 지향을 확인하거나 인증하는 절차는 아니에요. 선택하지 않으면 상대 노출·조회·대화가 중단돼요.</span></label>
        <label className="flex gap-3 text-sm leading-6"><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>프로필 표시·소개 대상 제한·운영 집계를 위해 위 항목과 동의 버전·시각을 탈퇴 또는 프로필 정보 삭제까지 보관하는 데 동의해요. 거부할 수 있으며, 거부하면 소개 기능은 이용할 수 없어요. <Link className="underline" href="/privacy">개인정보 안내</Link></span></label>
        <p className="text-xs leading-5 text-foreground/65">수정·저장하면 이전 인증이 해제되고 재인증 전까지 상대에게 보이지 않아요. 만 나이는 입력 시점 기준이며, 1년이 지나면 다시 입력·인증해야 해요.</p>
        <Button className="w-full" disabled={busy || !consent}>{save.isPending ? "저장 중…" : "기본 프로필 저장"}</Button>
        {save.isError ? <p role="alert" className="text-sm text-danger">{save.error.message}</p> : null}
      </form>
    </Card>
    <Card>
      <h2 className="text-xl font-black">실명·휴대전화 확인</h2>
      <p className="mt-3 text-sm leading-6">{setup.verificationAvailable ? "PortOne을 통한 다날 휴대폰 본인인증 화면에서 실명과 본인 명의 휴대전화 소유를 함께 확인해요. 팝업을 허용해 주세요." : "인증 서비스 준비 중이에요. 지금은 실명·전화번호를 입력하거나 제출할 수 없어요."}</p>
      <p className="mt-3 text-sm leading-6 text-foreground/70">실명·휴대전화 정보는 인증사 화면에서 입력해요. 서버가 결과를 확인할 때 원문을 일시 처리할 수 있지만, 확인 후 별도로 보관하지 않으며 회원 DB·애플리케이션 로그에도 저장하지 않아요. 인증 상태와 요청·동의 기록만 남겨요. 인증사 자신의 보유·파기 조건은 별도이며, 확정된 안내를 게시하기 전에는 연결하지 않아요. <Link className="underline" href="/privacy">개인정보 안내</Link></p>
      <p className="mt-3 text-sm">인증 상태: {({ not_started: "미인증", pending: "확인 대기", verified: "확인 완료", expired: "요청 만료" })[setup.verification]}</p>
      <label className="mt-4 flex gap-3 text-sm"><input type="checkbox" disabled={!setup.verificationAvailable} checked={identityConsent} onChange={(e) => setIdentityConsent(e.target.checked)} /><span>실명·본인 명의 휴대전화 확인을 위한 처리와 인증 결과 기록에 동의해요. 목적·항목·보유 및 파기 안내를 확인했으며, 거부하면 소개 기능을 이용할 수 없어요.</span></label>
      <Button className="mt-4 w-full" disabled={busy || !setup.verificationAvailable || !setup.basics?.introductionScopeAccepted || !identityConsent} onClick={() => verify.mutate("start")}>실명·휴대전화 인증 시작</Button>
      {identityRequest ? <Button className="mt-3 w-full" disabled={busy || !setup.verificationAvailable} onClick={() => verify.mutate("complete")}>인증 결과 확인</Button> : null}
      {verify.isError ? <p role="alert" className="mt-3 text-sm text-danger">{verify.error.message}</p> : null}
    </Card>
    <Card>
      <p className="text-sm leading-6" role="status">{setup.eligible ? "기본 정보·소개 범위 확인·인증·첫 질문 입력이 완료되어 소개 기능을 이용할 수 있어요." : "필수 정보·소개 범위 확인·인증·첫 질문 입력이 모두 완료되기 전에는 상대에게 보이지 않으며, 상대 조회와 대화도 제한돼요."}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold"><Link className="underline" href="/onboarding">첫 질문 작성</Link>{setup.eligible ? <Link className="underline" href="/app/home">상대 살펴보기</Link> : null}<Link className="underline" href="/app/settings">지원·계정 삭제</Link></div>
      {setup.basics ? <Button className="mt-5 w-full" disabled={busy} onClick={() => { if (window.confirm("성별·나이·활동 지역과 인증 결과를 삭제하고 상대 노출·대화를 중단할까요? 닉네임과 기존 대화는 계정 삭제 전까지 남아요.")) withdraw.mutate(); }}>기본 정보 삭제·소개 참여 철회</Button> : null}
      {withdraw.isError ? <p role="alert" className="mt-3 text-sm text-danger">{withdraw.error.message}</p> : null}
    </Card>
  </div>;
}
