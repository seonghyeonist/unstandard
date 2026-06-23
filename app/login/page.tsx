"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isMockAuthAllowed } from "@/lib/config/auth-mode-client";
import { startMockSession } from "@/app/login/actions";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!isMockAuthAllowed()) {
        throw new Error("Mock auth is disabled. Configure Supabase Auth.");
      }
      return startMockSession();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/onboarding");
    },
  });

  return (
    <AppShell title="닫힌 문 앞에서" eyebrow="login">
      <Card>
        <p className="text-lg leading-8 text-foreground/75">알파 기간에는 초대 링크를 받은 사람만 들어와요. 지금은 세션을 열고 첫 질문으로 바로 이동합니다.</p>
        <Button className="mt-6 w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !isMockAuthAllowed()}>
          {mutation.isPending ? "문 여는 중" : isMockAuthAllowed() ? "세션 시작하기" : "Supabase Auth 필요"}
        </Button>
        {mutation.isError ? <p className="mt-3 text-sm text-danger">{(mutation.error as Error).message}</p> : null}
      </Card>
    </AppShell>
  );
}
