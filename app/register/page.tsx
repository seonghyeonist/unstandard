"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signUpWithEmailPassword } from "@/app/login/actions";
import {
  CLOSED_ALPHA_SAFETY_RULES_VERSION,
  CLOSED_ALPHA_TERMS_VERSION,
} from "@/lib/legal/acceptance";

export default function RegisterPage() {
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
      if (!response.ok) {
        throw new Error("Invite claim failed");
      }
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async () => {
      await claimMutation.mutateAsync();
      await signUpWithEmailPassword(name, email, password);
    },
    onSuccess: () => {
      router.push("/profile-setup");
    },
  });

  return (
    <AppShell title="초대 확인" eyebrow="register">
      <Card>
        <p className="text-sm text-foreground/60">
          창업자가 발급한 초대코드로 가입해요. 가입 후 성별·만 나이·활동 지역과 소개 범위를 확인하며, 실명·전화번호는 별도 인증 절차로 분리돼요.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            signUpMutation.mutate();
          }}
        >
          <input
            type="text"
            placeholder="Invite code"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="text"
            placeholder="닉네임 (실명 입력 금지)"
            aria-label="닉네임"
            autoComplete="nickname"
            maxLength={16}
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password (min 10 chars)"
            autoComplete="new-password"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="space-y-3 rounded-2xl border border-line bg-background/60 p-4 text-sm leading-6">
            <label className="flex gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-accent"
                checked={adultConfirmed}
                onChange={(event) => setAdultConfirmed(event.target.checked)}
              />
              <span>나는 만 19세 이상이며 Closed Alpha가 성인 전용임을 확인합니다.</span>
            </label>
            <label className="flex gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-accent"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                <Link className="underline underline-offset-4" href="/terms">이용약관</Link>에 동의합니다.
              </span>
            </label>
            <label className="flex gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-accent"
                checked={safetyRulesAccepted}
                onChange={(event) => setSafetyRulesAccepted(event.target.checked)}
              />
              <span>
                <Link className="underline underline-offset-4" href="/safety">Community Safety Rules</Link>에 동의합니다.
              </span>
            </label>
            <p className="text-xs text-foreground/60">
              <Link className="underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>은 별도 동의가 아닌 고지 문서입니다.
            </p>
          </div>
          <Button
            className="w-full"
            type="submit"
            disabled={
              signUpMutation.isPending ||
              !inviteCode.trim() ||
              !email.trim() ||
              password.length < 10 ||
              !adultConfirmed ||
              !termsAccepted ||
              !safetyRulesAccepted
            }
          >
            {signUpMutation.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        {signUpMutation.isError ? (
          <p className="mt-3 text-sm text-danger">{(signUpMutation.error as Error).message}</p>
        ) : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/login">
          Back to sign in
        </Link>
      </Card>
    </AppShell>
  );
}
