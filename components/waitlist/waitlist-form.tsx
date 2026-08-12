"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-field";

async function getWaitlistState(): Promise<{ joined: boolean }> {
  const response = await fetch("/api/waitlist", { credentials: "include" });
  const body = (await response.json().catch(() => null)) as { joined?: boolean } | null;
  if (!response.ok) throw new Error("waitlist_state_failed");
  return { joined: body?.joined === true };
}

export function WaitlistForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const waitlist = useQuery({ queryKey: ["waitlist-state"], queryFn: getWaitlistState });
  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, acquisitionChannel: "organic" }),
      });
      if (!response.ok) throw new Error("waitlist_join_failed");
    },
    onSuccess: () => queryClient.setQueryData(["waitlist-state"], { joined: true }),
  });
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("waitlist_delete_failed");
    },
    onSuccess: () => {
      setEmail("");
      setConsent(false);
      queryClient.setQueryData(["waitlist-state"], { joined: false });
    },
  });

  if (waitlist.isLoading) {
    return <p className="text-sm text-foreground/60">대기 명단을 확인하는 중이에요.</p>;
  }

  if (waitlist.data?.joined) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-foreground/75">
          대기 명단에 기록했어요. 다른 날짜에 다시 찾아오면 재방문 지표에 익명 집계됩니다.
        </p>
        <button
          className="text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
          type="button"
          disabled={leaveMutation.isPending}
          onClick={() => leaveMutation.mutate()}
        >
          {leaveMutation.isPending ? "삭제 중…" : "이 브라우저의 대기 명단 정보 삭제"}
        </button>
        {leaveMutation.isError ? (
          <p className="text-xs text-danger">삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        joinMutation.mutate();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="waitlist-email">
        다음 초대 소식 받기
      </label>
      <TextInput
        id="waitlist-email"
        type="email"
        autoComplete="email"
        maxLength={320}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      <label className="flex items-start gap-3 text-xs leading-5 text-foreground/70">
        <input
          className="mt-1"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          알파 초대 안내를 위해 이메일과 재방문 날짜를 처리하는 데 동의합니다. 자세한 내용은{" "}
          <Link className="underline underline-offset-4" href="/privacy">개인정보 처리 안내</Link>에서 확인할 수 있어요.
        </span>
      </label>
      <Button className="w-full" disabled={!consent || joinMutation.isPending} type="submit">
        {joinMutation.isPending ? "기록 중…" : "대기 명단 등록"}
      </Button>
      {joinMutation.isError || waitlist.isError ? (
        <p className="text-xs text-danger">처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>
      ) : null}
    </form>
  );
}
