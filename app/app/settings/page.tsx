"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/api/auth";

async function logoutSession(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });

  const mutation = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      await queryClient.clear();
      router.push("/");
    },
  });

  const idPrefix = user?.idPrefix ?? user?.id.replace(/-/g, "").slice(0, 8) ?? "unknown";

  return (
    <AppShell title="설정" eyebrow="alpha">
      <AuthGuard requireOnboarded={false}>
        <Card>
          <p className="text-sm leading-6 text-foreground/70">
            Closed alpha staging session. User id prefix: <span className="font-mono">{idPrefix}</span>
          </p>
          <p className="mt-2 text-sm text-foreground/60">
            {user ? "Authenticated" : "Not authenticated"}
          </p>
          <p className="mt-4 text-sm leading-6 text-foreground/70">
            로그아웃하면 서버 세션 쿠키가 삭제됩니다.
          </p>
          <Button
            className="mt-6 w-full bg-foreground hover:bg-foreground/90"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "로그아웃 중…" : "로그아웃"}
          </Button>
          {mutation.isError ? (
            <p className="mt-3 text-sm text-danger">{(mutation.error as Error).message}</p>
          ) : null}
        </Card>
      </AuthGuard>
    </AppShell>
  );
}
