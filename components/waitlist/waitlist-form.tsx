"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentUtm, trackFunnel } from "@/lib/acquisition/client";
import { useRef, useState } from "react";
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
  const submitting = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const waitlist = useQuery({ queryKey: ["waitlist-state"], queryFn: getWaitlistState });
  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, acquisitionChannel: "organic", utm: currentUtm() }),
      }).catch(() => { throw new Error("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); });
      if (!response.ok) throw new Error(response.status === 429 ? "신청 요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요." : response.status === 503 ? "신청 서버에 잠시 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." : "이메일과 개인정보 동의를 확인하고 다시 시도해 주세요.");
    },
    onSuccess: () => {
      setAccepted(true);
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["waitlist-state"] });
    },
    onError: () => trackFunnel("waitlist_submit_error"),
    onSettled: () => { submitting.current = false; },
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
      setAccepted(false);
      setEmail("");
      setConsent(false);
      queryClient.setQueryData(["waitlist-state"], { joined: false });
    },
  });

  if (accepted || waitlist.data?.joined) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm leading-6 text-foreground/75">
          신청이 접수되었습니다. 초대 대상자로 선정되면 이메일로 안내해 드릴게요.
        </p>
        {waitlist.data?.joined ? <button
          className="text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
          type="button"
          disabled={leaveMutation.isPending}
          onClick={() => leaveMutation.mutate()}
        >
          {leaveMutation.isPending ? "삭제 중…" : "이 브라우저의 대기 명단 정보 삭제"}
        </button> : <p className="text-xs leading-5 text-foreground/60">신규·중복 여부는 공개하지 않습니다. 등록한 브라우저에서는 새로고침 후 삭제 기능을 이용할 수 있어요.</p>}
        {leaveMutation.isError ? (
          <p className="text-xs text-danger">삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>
        ) : null}
        <p className="text-xs leading-5 text-foreground/60">이 브라우저의 접수 정보만 삭제합니다. 다른 브라우저의 기존 신청은 삭제하지 않습니다.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!consent || submitting.current) return;
        submitting.current = true;
        trackFunnel("waitlist_submit_attempt");
        joinMutation.mutate();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="waitlist-email">
        초대 안내를 받을 이메일
      </label>
      <TextInput
        id="waitlist-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
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
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          알파 초대 안내를 위해 이메일과 재방문 날짜를 처리하는 데 동의합니다. 자세한 내용은{" "}
          <Link className="underline underline-offset-4" href="/privacy">개인정보 처리 안내</Link>에서 확인할 수 있어요.
        </span>
      </label>
      <Button className="w-full" disabled={!consent || joinMutation.isPending} type="submit">
        {joinMutation.isPending ? "접수 중…" : "알파 초대 신청하기"}
      </Button>
      {joinMutation.isError || waitlist.isError ? (
        <p role="alert" className="text-xs text-danger">{joinMutation.isError ? (joinMutation.error.message === "Failed to fetch" ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요." : joinMutation.error.message) : "이전 신청 상태를 확인하지 못했습니다. 새로고침하거나 신청을 다시 접수할 수 있어요."}</p>
      ) : null}
    </form>
  );
}
