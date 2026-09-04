"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextArea, TextInput } from "@/components/ui/form-field";
import { getCurrentUser } from "@/lib/api/auth";

async function logoutSession(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

async function createSupportRequest(input: { category: string; message: string }) {
  const response = await fetch("/api/support", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as { ticketId?: string } | null;
  if (!response.ok || !body?.ticketId) {
    throw new Error(response.status === 429 ? "요청 횟수를 초과했습니다. 내일 다시 시도해 주세요." : "지원 요청을 접수하지 못했습니다.");
  }
  return body.ticketId;
}

async function deleteAccount(password: string): Promise<void> {
  const response = await fetch("/api/auth/delete-user", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "삭제 시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요."
        : "비밀번호를 확인하거나 다시 로그인한 뒤 시도해 주세요.",
    );
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const [supportCategory, setSupportCategory] = useState("technical");
  const [supportMessage, setSupportMessage] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const mutation = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      await queryClient.clear();
      router.push("/");
    },
  });

  const supportMutation = useMutation({
    mutationFn: createSupportRequest,
    onSuccess: () => setSupportMessage(""),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await queryClient.clear();
      router.replace("/");
    },
  });

  const idPrefix = user?.idPrefix ?? "unknown";

  return (
    <AppShell title="설정" eyebrow="alpha">
      <AuthGuard requireOnboarded={false}>
        <Card className="mb-5"><Link href="/profile-setup" className="font-semibold underline">기본 프로필 수정·인증·소개 참여 철회</Link></Card>
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

        <Card className="mt-5">
          <h2 className="text-lg font-black tracking-[-0.03em]">지원·안전 요청</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/70">
            기술 문제, 신고 후속조치, 개인정보·계정 문의를 운영자가 확인합니다.
          </p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="support-category">
            분류
          </label>
          <select
            id="support-category"
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none"
            value={supportCategory}
            onChange={(event) => setSupportCategory(event.target.value)}
          >
            <option value="technical">기술 문제</option>
            <option value="safety">안전·moderation</option>
            <option value="privacy">개인정보</option>
            <option value="account">계정</option>
            <option value="other">기타</option>
          </select>
          <label className="mt-4 block text-sm font-semibold" htmlFor="support-message">
            내용
          </label>
          <TextArea
            id="support-message"
            className="mt-2"
            maxLength={2_000}
            value={supportMessage}
            onChange={(event) => setSupportMessage(event.target.value)}
            placeholder="문제 상황을 10자 이상 적어 주세요."
          />
          <Button
            className="mt-4 w-full"
            disabled={supportMutation.isPending || supportMessage.trim().length < 10}
            onClick={() => supportMutation.mutate({ category: supportCategory, message: supportMessage })}
          >
            {supportMutation.isPending ? "접수 중…" : "지원 요청 접수"}
          </Button>
          {supportMutation.data ? (
            <p className="mt-3 break-all text-sm text-foreground/70">
              접수 완료: <span className="font-mono">{supportMutation.data}</span>
            </p>
          ) : null}
          {supportMutation.isError ? (
            <p className="mt-3 text-sm text-danger">{supportMutation.error.message}</p>
          ) : null}
        </Card>

        <Card className="mt-5 border-danger/30">
          <h2 className="text-lg font-black tracking-[-0.03em] text-danger">계정과 데이터 삭제</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/70">
            삭제하면 프로필, 답변, 질문 노출, 일별 접속, 메시지, 해제 기록, 신고·지원 요청과 인증 데이터가 즉시 삭제되며 되돌릴 수 없습니다.
            Neon 복구 이력에서는 최대 6시간 뒤 만료됩니다.
          </p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="delete-password">
            현재 비밀번호
          </label>
          <TextInput
            id="delete-password"
            className="mt-2"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          <label className="mt-4 block text-sm font-semibold" htmlFor="delete-confirmation">
            확인을 위해 ‘계정 삭제’를 입력
          </label>
          <TextInput
            id="delete-confirmation"
            className="mt-2"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
          />
          <Button
            className="mt-4 w-full bg-danger hover:bg-danger/90"
            disabled={
              deleteMutation.isPending ||
              deletePassword.length < 10 ||
              deleteConfirmation !== "계정 삭제"
            }
            onClick={() => deleteMutation.mutate(deletePassword)}
          >
            {deleteMutation.isPending ? "삭제 중…" : "계정과 데이터 영구 삭제"}
          </Button>
          {deleteMutation.isError ? (
            <p className="mt-3 text-sm text-danger">{deleteMutation.error.message}</p>
          ) : null}
        </Card>

        <p className="py-6 text-center text-sm text-foreground/60">
          <Link href="/privacy" className="underline underline-offset-4">개인정보 처리 안내</Link>
        </p>
      </AuthGuard>
    </AppShell>
  );
}
