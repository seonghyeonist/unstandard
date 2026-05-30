"use client";

import { useQuery } from "@tanstack/react-query";
import { AuthGuard } from "@/components/layout/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { CandidateCard } from "@/components/profile/candidate-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getCandidates } from "@/lib/api/candidates";

export default function HomePage() {
  const candidates = useQuery({ queryKey: ["candidates"], queryFn: getCandidates });

  return (
    <AppShell title="오늘의 세 사람" eyebrow="curation">
      <AuthGuard>
        {candidates.isLoading ? <LoadingState label="오늘 어울릴 질문을 고르는 중이에요." /> : null}
        {candidates.isError ? <ErrorState body="후보를 불러오지 못했어요." onRetry={() => candidates.refetch()} /> : null}
        {candidates.data?.length === 0 ? <EmptyState title="오늘은 조용해요" body="새로운 질문이 도착하면 여기에 둘게요." /> : null}
        <div className="space-y-4">{candidates.data?.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}</div>
      </AuthGuard>
    </AppShell>
  );
}
