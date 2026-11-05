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
  if (errorCode === "auth_not_configured") return "현재 로그인 서비스를 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.";
  if (errorCode === "service_unavailable") return "로그인 서비스에 잠시 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.";
  return null;
}

function resolveSignInError(errorCode: "invalid_credentials" | "service_unavailable"): string {
  if (errorCode === "invalid_credentials") return "이메일 또는 비밀번호를 확인해 주세요.";
  return "로그인 서비스에 잠시 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.";
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
  const [signInError, setSignInError] = useState<string | null>(null);
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
    onSuccess: async (result) => {
      if (!result.ok) {
        setSignInError(resolveSignInError(result.errorCode));
        return;
      }

      setSignInError(null);
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/onboarding");
    },
  });

  return (
    <div className="entry-page"><AppShell title="기존 회원 로그인" eyebrow="로그인">
      <Card className="auth-entry">
        {databaseAuthEnabled ? (
          <>
            <p className="text-sm text-foreground/60">
              가입한 이메일과 비밀번호로 로그인해 주세요. 처음이라면 이메일로 받은 개인 초대 링크에서 가입을 시작할 수 있어요.
            </p>
            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setSignInError(null);
                signInMutation.mutate();
              }}
            >
              <label className="block text-sm text-foreground/70" htmlFor="login-email">이메일</label>
              <input id="login-email" type="email" autoComplete="email" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} disabled={signInMutation.isPending} />
              <label className="block text-sm text-foreground/70" htmlFor="login-password">비밀번호</label>
              <input id="login-password" type="password" autoComplete="current-password" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} disabled={signInMutation.isPending} />
              <Button className="w-full" type="submit" disabled={signInMutation.isPending || !email.trim() || password.length < 10}>
                {signInMutation.isPending ? "로그인 중…" : "로그인하기"}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
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
            {mockMutation.isPending ? "문 여는 중" : "개발용 세션 시작"}
          </Button>
        ) : null}

        {!mockAllowed && !databaseAuthEnabled ? <p className="mt-4 text-sm text-danger">현재 로그인 서비스를 사용할 수 없어요.</p> : null}
        {loginError ? <p className="mt-3 text-sm text-danger">{loginError}</p> : null}
        {mockMutation.isError ? <p className="mt-3 text-sm text-danger">{(mockMutation.error as Error).message}</p> : null}
        {signInError ? <p className="mt-3 text-sm text-danger" role="alert">{signInError}</p> : null}
        {signInMutation.isError ? <p className="mt-3 text-sm text-danger" role="alert">로그인 서비스에 잠시 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.</p> : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/">홈으로 돌아가기</Link>
      </Card>
    </AppShell></div>
  );
}
