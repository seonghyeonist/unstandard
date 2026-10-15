"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { BlurredProfileSection } from "@/components/profile/blurred-profile-section";
import { BlockButton } from "@/components/safety/block-button";
import { ReportButton } from "@/components/safety/report-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getUnlockStatus } from "@/lib/api/answers";
import { getPrivateProfile, getProfile } from "@/lib/api/profiles";

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const [blocked, setBlocked] = useState(false);
  const profile = useQuery({ queryKey: ["profile", params.id], queryFn: () => getProfile(params.id) });
  const unlock = useQuery({ queryKey: ["unlock-status", params.id], queryFn: () => getUnlockStatus(params.id) });
  const privateContent = useQuery({
    queryKey: ["profile-private", params.id],
    queryFn: () => getPrivateProfile(params.id),
    enabled: Boolean(unlock.data?.unlocked),
  });

  return (
    <AppShell>
      <AuthGuard>
        {profile.isLoading || unlock.isLoading ? <LoadingState label="프로필을 조심히 펼치는 중이에요." /> : null}
        {profile.isError ? <ErrorState body="프로필을 불러오지 못했어요." onRetry={() => profile.refetch()} /> : null}
        {profile.data ? (
          <div className="space-y-5">
            {blocked ? (
              <p className="rounded-2xl bg-muted p-4 text-sm text-foreground/70" role="status">
                이 프로필을 차단했어요. 메시지와 비공개 프로필 접근이 제한됩니다.
              </p>
            ) : (
              <>
                <ProfileHeader profile={profile.data} />
                <BlurredProfileSection
                  profile={profile.data}
                  unlocked={Boolean(unlock.data?.unlocked)}
                  privateContent={privateContent.data}
                />
                {unlock.data?.unlocked ? (
                  <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" href={`/app/chat/${profile.data.id}`}>첫 메시지 쓰기</Link>
                ) : (
                  <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" href={`/app/answer/${profile.data.id}`}>질문에 답하고 열기</Link>
                )}
                <div className="text-center">
                  <BlockButton targetProfileId={profile.data.id} onBlocked={() => setBlocked(true)} />
                </div>
              </>
            )}
            <div className="text-center"><ReportButton targetType="profile" targetId={profile.data.id} /></div>
          </div>
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
