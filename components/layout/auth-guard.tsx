"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/api/auth";
import { LoadingState } from "@/components/ui/states";

export function AuthGuard({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const router = useRouter();
  const { data: user, isLoading } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
    else if (requireOnboarded && !user.onboarded) router.replace("/onboarding");
  }, [isLoading, requireOnboarded, router, user]);

  if (isLoading || !user || (requireOnboarded && !user.onboarded)) return <LoadingState label="문을 여는 중이에요." />;
  return <>{children}</>;
}
