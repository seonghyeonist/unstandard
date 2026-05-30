"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logout } from "@/lib/api/auth";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.clear();
      router.push("/");
    },
  });

  return (
    <AppShell title="설정" eyebrow="alpha">
      <AuthGuard requireOnboarded={false}>
        <Card>
          <p className="text-sm leading-6 text-foreground/70">알파에서는 필요한 정보만 잠깐 씁니다. 브라우저 세션을 닫으면 데모 로그인 정보도 사라져요.</p>
          <Button className="mt-6 w-full bg-foreground hover:bg-foreground/90" onClick={() => mutation.mutate()}>로그아웃</Button>
        </Card>
      </AuthGuard>
    </AppShell>
  );
}
