"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signInWithEmailPassword, startMockSession } from "@/app/login/actions";
import { canonicalBrowserLocation } from "@/lib/auth/canonical-origin";

type LoginClientProps = {
  canonicalOrigin: string;
  mockAllowed: boolean;
  databaseAuthEnabled: boolean;
  errorCode?: string;
};

function resolveLoginError(errorCode?: string): string | null {
  if (errorCode === "auth_not_configured") return "Auth is not configured for this environment.";
  if (errorCode === "service_unavailable") return "Authentication is temporarily unavailable. Try again shortly.";
  return null;
}

export default function LoginClient({
  canonicalOrigin,
  mockAllowed,
  databaseAuthEnabled,
  errorCode,
}: LoginClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginError = resolveLoginError(errorCode);

  useEffect(() => {
    if (window.location.origin === canonicalOrigin) return;
    window.location.replace(canonicalBrowserLocation(canonicalOrigin, window.location));
  }, [canonicalOrigin]);

  const mockMutation = useMutation({
    mutationFn: async () => startMockSession(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/onboarding");
    },
  });

  const signInMutation = useMutation({
    mutationFn: async () => signInWithEmailPassword(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/onboarding");
    },
  });

  return (
    <AppShell title="닫힌 문 앞에서" eyebrow="login">
      <Card>
        {databaseAuthEnabled ? (
          <>
            <p className="text-sm text-foreground/60">
              Closed Alpha — 개인 초대 링크를 받은 신규 회원은 이메일과 비밀번호로 가입합니다. 기존 회원도 같은 방식으로 로그인해요.
            </p>
            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                signInMutation.mutate();
              }}
            >
              <label className="block text-sm text-foreground/70" htmlFor="login-email">Email</label>
              <input id="login-email" type="email" autoComplete="email" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} disabled={signInMutation.isPending} />
              <label className="block text-sm text-foreground/70" htmlFor="login-password">Password</label>
              <input id="login-password" type="password" autoComplete="current-password" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} disabled={signInMutation.isPending} />
              <Button className="w-full" type="submit" disabled={signInMutation.isPending || !email.trim() || password.length < 10}>
                {signInMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="mt-4 flex justify-between gap-4 text-sm">
              <Link className="text-foreground/70 underline" href="/reset-password">비밀번호 재설정</Link>
              <Link className="text-foreground/70 underline" href="/register">초대 링크로 가입</Link>
            </div>
          </>
        ) : (
          <p className="text-lg leading-8 text-foreground/75">
            알파 기간에는 초대 링크를 받은 사람만 들어와요. 지금은 세션을 열고 첫 질문으로 바로 이동합니다.
          </p>
        )}

        {mockAllowed ? (
          <Button className={`mt-6 w-full ${databaseAuthEnabled ? "bg-foreground/10 text-foreground hover:bg-foreground/15" : ""}`} onClick={() => mockMutation.mutate()} disabled={mockMutation.isPending}>
            {mockMutation.isPending ? "문 여는 중" : "Dev mock session"}
          </Button>
        ) : null}

        {!mockAllowed && !databaseAuthEnabled ? <p className="mt-4 text-sm text-danger">Database auth is required in this environment.</p> : null}
        {loginError ? <p className="mt-3 text-sm text-danger">{loginError}</p> : null}
        {mockMutation.isError ? <p className="mt-3 text-sm text-danger">{(mockMutation.error as Error).message}</p> : null}
        {signInMutation.isError ? <p className="mt-3 text-sm text-danger">{(signInMutation.error as Error).message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/">Back to home</Link>
      </Card>
    </AppShell>
  );
}
