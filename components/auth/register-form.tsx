"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import type { SocialProviderAvailability, SocialProviderId } from "@/lib/auth/social-config";
import { CLOSED_ALPHA_NEW_MEMBER_PROVIDER } from "@/lib/auth/new-member-provider";
import { canonicalBrowserLocation } from "@/lib/auth/canonical-origin";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
} from "@/lib/legal/acceptance";

type InviteState = "checking" | "ready" | "missing" | "invalid";

export default function RegisterForm({
  canonicalOrigin,
  socialProviders,
  initialInviteReady,
}: {
  canonicalOrigin: string;
  socialProviders: SocialProviderAvailability;
  initialInviteReady: boolean;
}) {
  const [preparedState, setPreparedState] = useState<"ready" | "invalid" | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [safetyRulesAccepted, setSafetyRulesAccepted] = useState(false);

  const capability = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    },
    () => new URLSearchParams(window.location.hash.slice(1)).get("invite"),
    () => null,
  );
  const inviteState: InviteState = initialInviteReady || preparedState === "ready"
    ? "ready"
    : preparedState === "invalid" ? "invalid" : capability ? "checking" : "missing";

  const onCanonicalOrigin = typeof window === "undefined" || window.location.origin === canonicalOrigin;

  useEffect(() => {
    if (window.location.origin === canonicalOrigin) return;
    window.location.replace(canonicalBrowserLocation(canonicalOrigin, window.location));
  }, [canonicalOrigin]);

  useEffect(() => {
    if (!onCanonicalOrigin || !capability) return;

    // Fragments are not sent as HTTP Referer values, and remove it before the
    // same-origin POST so an invite capability never remains in browser UI.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    let cancelled = false;
    void fetch("/api/alpha/invite/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ capability }),
    }).then((response) => {
      if (!cancelled) setPreparedState(response.ok ? "ready" : "invalid");
    }).catch(() => {
      if (!cancelled) setPreparedState("invalid");
    });
    return () => { cancelled = true; };
  }, [capability, onCanonicalOrigin]);

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
      if (!response.ok) throw new Error("초대를 확인하지 못했어요. 새 초대 링크를 받아 다시 열어 주세요.");
    },
  });

  const socialMutation = useMutation({
    mutationFn: async (provider: SocialProviderId) => {
      if (window.location.origin !== canonicalOrigin) {
        window.location.replace(canonicalBrowserLocation(canonicalOrigin, window.location));
        throw new Error("안전한 가입 주소로 이동 중이에요. 이동한 화면에서 다시 계속해 주세요.");
      }
      await claimMutation.mutateAsync();
      const result = provider === "naver"
        ? await authClient.signIn.oauth2({
          providerId: provider,
          callbackURL: "/profile-setup",
          newUserCallbackURL: "/profile-setup",
          errorCallbackURL: "/login",
          requestSignUp: true,
          disableRedirect: true,
        })
        : await authClient.signIn.social({
          provider,
          callbackURL: "/profile-setup",
          newUserCallbackURL: "/profile-setup",
          errorCallbackURL: "/login",
          requestSignUp: true,
          disableRedirect: true,
        });
      if (result.error || !result.data?.url) {
        throw new Error("소셜 가입을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      window.location.assign(result.data.url);
    },
  });

  const busy = socialMutation.isPending || claimMutation.isPending;
  const legalReady = adultConfirmed && termsAccepted && safetyRulesAccepted;
  const inviteReady = inviteState === "ready";
  const error = socialMutation.error || claimMutation.error;

  return (
    <AppShell title="초대 확인" eyebrow="register">
      <Card>
        {inviteState === "checking" ? (
          <p className="text-sm text-foreground/60">초대 링크를 안전하게 확인하는 중이에요.</p>
        ) : null}
        {inviteState === "missing" ? (
          <p className="text-sm leading-6 text-foreground/60">가입은 이메일로 받은 개인 초대 링크에서 시작해요. 링크를 다시 열어 주세요.</p>
        ) : null}
        {inviteState === "invalid" ? (
          <p className="text-sm leading-6 text-danger">이 초대 링크는 유효하지 않거나 만료됐어요. 발급자에게 새 링크를 요청해 주세요.</p>
        ) : null}
        {inviteReady ? (
          <>
            <p className="text-sm leading-6 text-foreground/60">
              초대가 확인됐어요. 성인 전용 Closed Alpha의 약속을 확인한 뒤, 사용할 계정으로 계속해요.
              닉네임은 가입 뒤 프로필 설정에서 정합니다.
            </p>
            <div className="mt-6 space-y-3 rounded-2xl border border-line bg-background/60 p-4 text-sm leading-6">
              <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /><span>나는 만 19세 이상이며 Closed Alpha가 성인 전용임을 확인합니다.</span></label>
              <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/terms">이용약관</Link>에 동의합니다.</span></label>
              <label className="flex gap-3"><input type="checkbox" className="mt-1 size-4 accent-accent" checked={safetyRulesAccepted} onChange={(event) => setSafetyRulesAccepted(event.target.checked)} /><span><Link className="underline underline-offset-4" href="/safety">Community Safety Rules</Link>에 동의합니다.</span></label>
              <p className="text-xs text-foreground/60"><Link className="underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>은 별도 동의가 아닌 고지 문서입니다.</p>
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-sm font-semibold">계정 선택</p>
              <p className="mt-2 text-xs leading-5 text-foreground/60">초대에 등록된 이메일과 같은 Google 계정으로만 가입할 수 있어요. Google의 이름·전화번호·생년월일은 앱 프로필로 가져오지 않아요.</p>
              <div className="mt-3">
                <Button type="button" className="w-full bg-foreground hover:bg-foreground/80" disabled={busy || !legalReady || !socialProviders[CLOSED_ALPHA_NEW_MEMBER_PROVIDER]} onClick={() => socialMutation.mutate(CLOSED_ALPHA_NEW_MEMBER_PROVIDER)}>
                  Google로 계속
                </Button>
              </div>
              {!socialProviders[CLOSED_ALPHA_NEW_MEMBER_PROVIDER] ? <p className="mt-2 text-xs text-foreground/60">Google 가입은 현재 준비 중이에요. 초대 발급자에게 알려 주세요.</p> : null}
            </div>
          </>
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{(error as Error).message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/login">기존 계정으로 로그인</Link>
      </Card>
    </AppShell>
  );
}
