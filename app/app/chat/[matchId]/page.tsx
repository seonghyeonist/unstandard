"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageComposer } from "@/components/chat/message-composer";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getMessages } from "@/lib/api/matches";

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const messages = useQuery({ queryKey: ["messages", params.matchId], queryFn: () => getMessages(params.matchId) });

  return (
    <AppShell title="첫 메시지" eyebrow="match">
      <AuthGuard>
        <div className="space-y-4">
          {messages.isLoading ? <LoadingState label="대화를 여는 중이에요." /> : null}
          {messages.isError ? <ErrorState body="메시지를 불러오지 못했어요." onRetry={() => messages.refetch()} /> : null}
          <Card className="space-y-3">
            {messages.data?.map((message) => (
              <p key={message.id} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.author === "me" ? "ml-8 bg-accent text-white" : "mr-8 bg-background"}`}>{message.body}</p>
            ))}
          </Card>
          <MessageComposer matchId={params.matchId} />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
