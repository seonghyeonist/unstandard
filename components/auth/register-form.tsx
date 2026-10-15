"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { completeInviteSignup } from "@/app/login/actions";
import { canonicalBrowserLocation } from "@/lib/auth/canonical-origin";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
} from "@/lib/legal/acceptance";

type InviteState = "checking" | "missing" | "invalid" | "invite_ready" | "code_sent" | "email_verified" | "password_ready";

type StatusResponse = {
  state?: InviteState | "unavailable";
  email?: string;
};

function readHashInvite() {
  return new URLSearchParams(window.location.hash.slice(1)).get("invite");
}

export default function RegisterForm({
  canonicalOrigin,
  initialInviteReady,
}: {
  canonicalOrigin: string;
  initialInviteReady: boolean;
}) {
  const router = useRouter();
  const [inviteState, setInviteState] = useState<InviteState>(initialInviteReady ? "checking" : "missing");
  const [inviteEmail, setInviteEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [safetyRulesAccepted, setSafetyRulesAccepted] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const capability = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    },
    readHashInvite,
    () => null,
  );
  const onCanonicalOrigin = typeof window === "undefined" || window.location.origin === canonicalOrigin;
  const markInviteInvalid = () => setInviteState("invalid");

  async function refreshStatus() {
    const response = await fetch("/api/alpha/invite/status", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("초대 상태를 확인하지 못했어요.");
    const data = (await response.json()) as StatusResponse;
    if (data.email) setInviteEmail(data.email);
    if (data.state === "unavailable") throw new Error("가입 서비스를 잠시 사용할 수 없어요.");
    setInviteState(data.state && data.state !== "checking" ? data.state : "missing");
  }

  useEffect(() => {
    if (window.location.origin === canonicalOrigin) return;
    window.location.replace(canonicalBrowserLocation(canonicalOrigin, window.location));
  }, [canonicalOrigin]);

  useEffect(() => {
    if (!onCanonicalOrigin) return;
    if (!capability) {
      if (initialInviteReady) void Promise.resolve().then(() => refreshStatus()).catch(markInviteInvalid);
      return;
    }

    // The capability is read from the fragment and removed before the
    // same-origin exchange. It is never put in browser storage or analytics.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    let cancelled = false;
    void fetch("/api/alpha/invite/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ capability }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid");
        await refreshStatus();
      })
      .catch(() => {
        if (!cancelled) markInviteInvalid();
      });
    return () => { cancelled = true; };
  }, [capability, initialInviteReady, onCanonicalOrigin]);

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/alpha/invite/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const data = (await response.json().catch(() => ({}))) as { challengeId?: string; error?: string };
      if (!response.ok || !data.challengeId) throw new Error(data.error || "인증 코드를 보내지 못했어요.");
      return data.challengeId;
    },
    onSuccess: (nextChallengeId) => {
      setChallengeId(nextChallengeId);
      setInviteState("code_sent");
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/alpha/invite/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ challengeId, code: verificationCode }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "인증 코드가 맞지 않아요.");
    },
    onSuccess: () => setInviteState("email_verified"),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/alpha/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          adultConfirmed,
          termsAccepted,
          safetyRulesAccepted,
          termsVersion: CLOSED_ALPHA_TERMS_VERSION,
          safetyRulesVersion: CLOSED_ALPHA_SAFETY_RULES_VERSION,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "초대를 확인하지 못했어요.");
    },
    onSuccess: () => setInviteState("password_ready"),
  });

  const signupMutation = useMutation({
    mutationFn: async () => {
      if (password.length < 10) throw new Error("비밀번호는 10자 이상이어야 해요.");
      if (password !== passwordConfirmation) throw new Error("비밀번호가 일치하지 않아요.");
      return completeInviteSignup(password);
    },
    onSuccess: () => router.push("/profile-setup"),
  });

  const legalReady = adultConfirmed && termsAccepted && safetyRulesAccepted;
  const busy = sendCodeMutation.isPending || verifyCodeMutation.isPending || claimMutation.isPending || signupMutation.isPending;
  const error = sendCodeMutation.error || verifyCodeMutation.error || claimMutation.error || signupMutation.error;

  return (
    <AppShell title="초대 확인" eyebrow="register">
      <Card>
        {inviteState === "checking" ? <p className="text-sm text-foreground/60">초대 링크를 안전하게 확인하는 중이에요.</p> : null}
        {inviteState === "missing" ? <p className="text-sm leading-6 text-foreground/60">가입은 이메일로 받은 개인 초대 링크에서 시작해요. 링크를 다시 열어 주세요.</p> : null}
        {inviteState === "invalid" ? <p className="text-sm leading-6 text-danger">이 초대 링크는 유효하지 않거나 만료됐어요. 발급자에게 새 링크를 요청해 주세요.</p> : null}

        {inviteState !== "checking" && inviteState !== "missing" && inviteState !== "invalid" ? (
          <>
            <p className="text-sm leading-6 text-foreground/60">
              개인 초대가 확인됐어요. 이메일 소유권을 확인한 뒤 비밀번호를 설정합니다.
              닉네임과 나머지 프로필 정보는 가입 뒤 프로필 설정에서 정해요.
            </p>
            <div className="mt-5 rounded-2xl border border-line bg-background/60 p-4 text-sm">
              <p className="text-xs text-foreground/60">초대 대상 이메일</p>
              <p className="mt-1 break-all font-medium">{inviteEmail || "확인 중"}</p>
            </div>

            {inviteState === "invite_ready" ? (
              <div className="mt-5">
                <p className="text-sm leading-6 text-foreground/70">이 이메일로 일회용 인증 코드를 보내요. 사용자가 요청할 때만 발송됩니다.</p>
                <Button type="button" className="mt-3 w-full" disabled={busy} onClick={() => sendCodeMutation.mutate()}>
                  {sendCodeMutation.isPending ? "보내는 중…" : "이메일 인증 코드 보내기"}
                </Button>
              </div>
            ) : null}

            {inviteState === "code_sent" ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm text-foreground/70" htmlFor="verification-code">이메일 인증 코드</label>
                <input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm tracking-[0.3em]" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={busy} />
                <Button type="button" className="w-full" disabled={busy || verificationCode.length !== 6} onClick={() => verifyCodeMutation.mutate()}>
                  {verifyCodeMutation.isPending ? "확인하는 중…" : "이메일 소유권 확인"}
                </Button>
                <button type="button" className="w-full text-xs text-foreground/60 underline" disabled={busy} onClick={() => sendCodeMutation.mutate()}>코드를 다시 보내기</button>
              </div>
            ) : null}

            {inviteState === "email_verified" ? (
              <div className="mt-5">
                <p className="text-sm text-foreground/70">이메일 소유권이 확인됐어요. 필수 동의를 기록하고 비밀번호 설정으로 계속합니다.</p>
                <div className="mt-4 space-y-3 rounded-2xl border border-line bg-background/60 p-4 text-sm leading-6">
                  <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /><span>나는 만 19세 이상이며 Closed Alpha가 성인 전용임을 확인합니다.</span></label>
                  <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/terms">이용약관</Link>에 동의합니다.</span></label>
                  <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={safetyRulesAccepted} onChange={(event) => setSafetyRulesAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/safety">Community Safety Rules</Link>에 동의합니다.</span></label>
                  <p className="text-xs text-foreground/60"><Link className="underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>은 별도 동의가 아닌 고지 문서입니다.</p>
                </div>
                <Button type="button" className="mt-4 w-full" disabled={busy || !legalReady} onClick={() => claimMutation.mutate()}>
                  {claimMutation.isPending ? "확인하는 중…" : "비밀번호 설정으로 계속"}
                </Button>
              </div>
            ) : null}

            {inviteState === "password_ready" ? (
              <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); signupMutation.mutate(); }}>
                <p className="text-sm text-foreground/70">필수 동의가 기록됐어요. 비밀번호 관리자와 붙여넣기를 사용할 수 있습니다.</p>
                <label className="block text-sm text-foreground/70" htmlFor="register-password">비밀번호</label>
                <input id="register-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                <label className="block text-sm text-foreground/70" htmlFor="register-password-confirmation">비밀번호 확인</label>
                <input id="register-password-confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} disabled={busy} />
                <p className="text-xs leading-5 text-foreground/60">10–128자이며 흔한 비밀번호·반복 문자열은 사용할 수 없어요. 다른 서비스에서 재사용하지 않는 긴 비밀번호를 사용하세요.</p>
                <Button type="submit" className="w-full" disabled={busy || password.length < 10 || password !== passwordConfirmation}>
                  {signupMutation.isPending ? "계정 만드는 중…" : "계정 만들기"}
                </Button>
              </form>
            ) : null}
          </>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{(error as Error).message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/login">기존 계정으로 로그인</Link>
      </Card>
    </AppShell>
  );
}
