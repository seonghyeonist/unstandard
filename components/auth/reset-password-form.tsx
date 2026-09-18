"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordForm({ canonicalOrigin, initialToken }: { canonicalOrigin: string; initialToken: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token] = useState<string | null>(initialToken);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (initialToken) {
      // Capture the token only in memory; remove it from the visible URL so
      // history, screenshots and referrers do not retain it.
      window.history.replaceState(null, "", `${window.location.pathname}`);
    }
  }, [initialToken]);

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!email.trim() || !email.includes("@")) throw new Error("이메일 주소를 입력해 주세요.");
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${canonicalOrigin}/reset-password`,
      });
      if (result.error) throw new Error("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("재설정 링크가 없거나 만료됐어요.");
      if (password.length < 10) throw new Error("비밀번호는 10자 이상이어야 해요.");
      if (password !== confirmation) throw new Error("비밀번호가 일치하지 않아요.");
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error("재설정 링크가 없거나 만료됐어요.");
    },
    onSuccess: () => router.push("/login"),
  });

  const error = requestMutation.error || resetMutation.error;

  return (
    <AppShell title="비밀번호 재설정" eyebrow="reset-password">
      <Card>
        {token ? (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); resetMutation.mutate(); }}>
            <p className="text-sm leading-6 text-foreground/70">10–128자의 흔하지 않은 비밀번호를 사용하세요. 저장하면 기존 세션은 폐기됩니다.</p>
            <label className="block text-sm text-foreground/70" htmlFor="reset-password">새 비밀번호</label>
            <input id="reset-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} disabled={resetMutation.isPending} />
            <label className="block text-sm text-foreground/70" htmlFor="reset-password-confirmation">비밀번호 확인</label>
            <input id="reset-password-confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={resetMutation.isPending} />
            <Button className="w-full" type="submit" disabled={resetMutation.isPending || password.length < 10 || password !== confirmation}>
              {resetMutation.isPending ? "저장하는 중…" : "새 비밀번호 저장"}
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); requestMutation.mutate(); }}>
            <p className="text-sm leading-6 text-foreground/70">계정 이메일을 입력하면, 존재 여부와 관계없이 같은 안내를 보여드려요.</p>
            <label className="block text-sm text-foreground/70" htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="email" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} disabled={requestMutation.isPending} />
            <Button className="w-full" type="submit" disabled={requestMutation.isPending || !email.trim()}>
              {requestMutation.isPending ? "보내는 중…" : "재설정 이메일 보내기"}
            </Button>
            {requestMutation.isSuccess ? <p className="text-sm text-foreground/70">입력한 주소가 계정에 연결되어 있다면 재설정 링크를 보냈어요.</p> : null}
          </form>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{(error as Error).message}</p> : null}
      </Card>
    </AppShell>
  );
}
