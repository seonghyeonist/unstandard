"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { AnswerForm } from "@/components/question/answer-form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getUnlockStatus } from "@/lib/api/answers";
import { getProfile } from "@/lib/api/profiles";

export default function AnswerPage() {
  const params = useParams<{ profileId: string }>();
  const profile = useQuery({ queryKey: ["profile", params.profileId], queryFn: () => getProfile(params.profileId) });
  const unlock = useQuery({ queryKey: ["unlock-status", params.profileId], queryFn: () => getUnlockStatus(params.profileId) });

  return (
    <AppShell>
      <AuthGuard>
        {profile.isLoading ? <LoadingState label="질문을 가져오는 중이에요." /> : null}
        {profile.isError ? <ErrorState body="질문을 불러오지 못했어요." onRetry={() => profile.refetch()} /> : null}
        {profile.data ? (
          <div className="space-y-5">
            <AnswerForm profileId={profile.data.id} question={profile.data.question} />
            {unlock.data?.unlocked ? <Link className="block text-center text-sm font-bold text-accent" href={`/app/profile/${profile.data.id}`}>열린 프로필 보러가기</Link> : null}
          </div>
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
