"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentUtm, trackFunnel } from "@/lib/acquisition/client";
import { useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-field";

async function getWaitlistState(): Promise<{ joined: boolean }> {
  const response = await fetch("/api/waitlist", { credentials: "include" });
  const body = (await response.json().catch(() => null)) as { joined?: boolean } | null;
  if (!response.ok) throw new Error("waitlist_state_failed");
  return { joined: body?.joined === true };
}

const emailSchema = z.string().trim().email().max(320);

export function WaitlistForm() {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const consentInput = useRef<HTMLInputElement>(null);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [consentError, setConsentError] = useState("");
  const waitlist = useQuery({ queryKey: ["waitlist-state"], queryFn: getWaitlistState });
  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, acquisitionChannel: "organic", utm: currentUtm() }),
      }).catch(() => { throw new Error("네트워크 연결을 확인한 뒤 다시 시도해 주세요. 입력한 이메일은 그대로 남아 있어요."); });
      if (!response.ok) throw new Error(response.status === 429
        ? "신청 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요."
        : response.status === 503
          ? "신청 서버에 잠시 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요."
          : "신청을 접수하지 못했어요. 이메일과 개인정보 동의를 확인하고 다시 시도해 주세요.");
    },
    onSuccess: () => {
      setAccepted(true);
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["waitlist-state"] });
    },
    onError: () => trackFunnel("waitlist_submit_error"),
    onSettled: () => { submitting.current = false; },
  });
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist", { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("waitlist_delete_failed");
    },
    onSuccess: () => {
      setAccepted(false); setEmail(""); setConsent(false);
      queryClient.setQueryData(["waitlist-state"], { joined: false });
    },
  });

  if (accepted || waitlist.data?.joined) {
    return (
      <div className="waitlist-receipt" role="status" aria-live="polite">
        <p className="waitlist-receipt-title">신청이 접수되었습니다.</p>
        <p>초대 대상으로 선정되면 이메일로 가입 링크를 보내드려요.</p>
        {waitlist.data?.joined ? <button className="waitlist-delete" type="button" disabled={leaveMutation.isPending} onClick={() => leaveMutation.mutate()}>
          {leaveMutation.isPending ? "삭제 중…" : "이 브라우저의 대기 명단 정보 삭제"}
        </button> : <p className="waitlist-note">등록한 브라우저에서는 새로고침 후 삭제 기능을 이용할 수 있어요.</p>}
        {leaveMutation.isError ? <p role="alert" className="waitlist-error">삭제하지 못했어요. 연결을 확인한 뒤 삭제 버튼으로 다시 시도해 주세요.</p> : null}
        <p className="waitlist-note">이 브라우저의 접수 정보만 삭제합니다. 다른 브라우저의 기존 신청은 삭제하지 않습니다.</p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" noValidate aria-busy={joinMutation.isPending} onSubmit={(event) => {
      event.preventDefault();
      if (submitting.current) return;
      const invalidEmail = !emailSchema.safeParse(email).success;
      setEmailError(invalidEmail ? "이메일 주소를 확인해 주세요. 예: you@example.com" : "");
      setConsentError(!consent ? "초대 안내를 받으려면 개인정보 처리 동의가 필요해요." : "");
      if (invalidEmail || !consent) {
        if (invalidEmail) emailInput.current?.focus();
        else consentInput.current?.focus();
        return;
      }
      submitting.current = true;
      trackFunnel("waitlist_submit_attempt");
      joinMutation.mutate();
    }}>
      <label className="waitlist-label" htmlFor="waitlist-email">초대 안내를 받을 이메일</label>
      <TextInput ref={emailInput} id="waitlist-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={320} required value={email} disabled={joinMutation.isPending}
        aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "waitlist-email-error" : undefined}
        onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(""); }} placeholder="you@example.com" />
      {emailError ? <p id="waitlist-email-error" role="alert" className="waitlist-error">{emailError}</p> : null}
      <label className="waitlist-consent">
        <span className="waitlist-checkbox-target"><input ref={consentInput} id="waitlist-consent" type="checkbox" required checked={consent} disabled={joinMutation.isPending}
          aria-invalid={Boolean(consentError)} aria-describedby={consentError ? "waitlist-consent-error" : "waitlist-consent-help"}
          onChange={(event) => { setConsent(event.target.checked); if (consentError) setConsentError(""); }} /></span>
        <span id="waitlist-consent-help">알파 초대 안내를 위해 이메일과 재방문 날짜를 처리하는 데 동의합니다. 자세한 내용은 <Link href="/privacy">개인정보 처리 안내</Link>에서 확인할 수 있어요.</span>
      </label>
      {consentError ? <p id="waitlist-consent-error" role="alert" className="waitlist-error">{consentError}</p> : null}
      <p className="waitlist-note">{!consent ? "개인정보 처리 동의 후 신청할 수 있어요." : "동의했어요. 아래 버튼으로 신청을 접수해 주세요."}</p>
      <Button className="waitlist-submit" disabled={joinMutation.isPending} type="submit">{joinMutation.isPending ? "접수 중…" : "알파 초대 신청하기"}</Button>
      {joinMutation.isError ? <p role="alert" className="waitlist-error">{joinMutation.error.message} 입력한 내용을 확인한 뒤 신청 버튼으로 다시 시도할 수 있어요.</p> : null}
      {waitlist.isError ? <p role="alert" className="waitlist-note">이전 신청 상태를 확인하지 못했어요. <button type="button" className="waitlist-retry" onClick={() => void waitlist.refetch()}>신청 상태 다시 확인</button>하거나 위 폼으로 다시 신청할 수 있어요.</p> : null}
    </form>
  );
}
