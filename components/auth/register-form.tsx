"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signUpWithEmailPassword } from "@/app/login/actions";
import { authClient } from "@/lib/auth/client";
import type { SocialProviderAvailability, SocialProviderId } from "@/lib/auth/social-config";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
} from "@/lib/legal/acceptance";

export default function RegisterForm({ socialProviders }: { socialProviders: SocialProviderAvailability }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [safetyRulesAccepted, setSafetyRulesAccepted] = useState(false);

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/alpha/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: inviteCode,
          adultConfirmed,
          termsAccepted,
          safetyRulesAccepted,
          termsVersion: CLOSED_ALPHA_TERMS_VERSION,
          safetyRulesVersion: CLOSED_ALPHA_SAFETY_RULES_VERSION,
        }),
      });
      if (!response.ok) throw new Error("Invite claim failed");
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async () => {
      await claimMutation.mutateAsync();
      await signUpWithEmailPassword(name, email, password);
    },
    onSuccess: () => router.push("/profile-setup"),
  });

  const socialMutation = useMutation({
    mutationFn: async (provider: SocialProviderId) => {
      await claimMutation.mutateAsync();
      const result = provider === "naver"
        ? await authClient.signIn.oauth2({
          providerId: provider,
          callbackURL: "/profile-setup",
          newUserCallbackURL: "/profile-setup",
          errorCallbackURL: "/register",
          requestSignUp: true,
          disableRedirect: true,
        })
        : await authClient.signIn.social({
          provider,
          callbackURL: "/profile-setup",
          newUserCallbackURL: "/profile-setup",
          errorCallbackURL: "/register",
          requestSignUp: true,
          disableRedirect: true,
        });
      if (result.error || !result.data?.url) {
        throw new Error("소셜 가입을 시작하지 못했어요. 초대 이메일과 제공자 설정을 확인해 주세요.");
      }
      window.location.assign(result.data.url);
    },
  });

  const busy = signUpMutation.isPending || socialMutation.isPending || claimMutation.isPending;
  const legalAndInviteReady = Boolean(
    inviteCode.trim() && email.trim() && adultConfirmed && termsAccepted && safetyRulesAccepted,
  );
  const error = signUpMutation.error || socialMutation.error;

  return (
    <AppShell title="초대 확인" eyebrow="register">
      <Card>
        <p className="text-sm text-foreground/60">
          창업자가 발급한 초대코드로 가입해요. 가입 후 성별·만 나이·활동 지역과 소개 범위를 확인하며, 실명·전화번호는 별도 인증 절차로 분리돼요.
        </p>
        <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); signUpMutation.mutate(); }}>
          <input type="text" placeholder="Invite code" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          <input type="email" placeholder="Email" autoComplete="email" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input type="text" placeholder="닉네임 (실명 입력 금지)" aria-label="닉네임" autoComplete="nickname" maxLength={16} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} />
          <input type="password" placeholder="Password (min 10 chars)" autoComplete="new-password" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="space-y-3 rounded-2xl border border-line bg-background/60 p-4 text-sm leading-6">
            <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /><span>나는 만 19세 이상이며 Closed Alpha가 성인 전용임을 확인합니다.</span></label>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/terms">이용약관</Link>에 동의합니다.</span></label>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={safetyRulesAccepted} onChange={(event) => setSafetyRulesAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/safety">Community Safety Rules</Link>에 동의합니다.</span></label>
            <p className="text-xs text-foreground/60"><Link className="underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>은 별도 동의가 아닌 고지 문서입니다.</p>
          </div>
          <Button className="w-full" type="submit" disabled={busy || !legalAndInviteReady || password.length < 10}>{signUpMutation.isPending ? "Creating account…" : "Create account"}</Button>
        </form>
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm font-semibold">또는 Google/Naver로 가입</p>
          <p className="mt-2 text-xs leading-5 text-foreground/60">위 초대코드·이메일·약관 확인을 먼저 통과해야 하며, 초대 이메일과 OAuth 계정 이메일이 서버에서 일치해야 가입돼요. 제공자 이름·전화번호·생년월일은 앱 프로필로 가져오지 않아요.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["google", "naver"] as const).map((provider) => (
              <Button key={provider} type="button" className={provider === "google" ? "bg-foreground hover:bg-foreground/80" : "bg-[#03c75a] hover:bg-[#02a94d]"} disabled={busy || !legalAndInviteReady || !socialProviders[provider]} onClick={() => socialMutation.mutate(provider)}>
                {provider === "google" ? "Google로 가입" : "Naver로 가입"}
              </Button>
            ))}
          </div>
          {!socialProviders.google && !socialProviders.naver ? <p className="mt-2 text-xs text-foreground/60">소셜 가입은 외부 OAuth 앱 설정 후 활성화됩니다.</p> : null}
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{(error as Error).message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/login">Back to sign in</Link>
      </Card>
    </AppShell>
  );
}
