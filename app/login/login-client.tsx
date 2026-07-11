"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startMockSession } from "@/app/login/actions";

type LoginClientProps = {
  mockAllowed: boolean;
  supabaseEnabled: boolean;
  oauthProvider?: string;
  errorCode?: string;
};

type MagicLinkResponse = {
  ok?: boolean;
  error?: string;
};

async function requestSupabaseMagicLink(email: string) {
  const response = await fetch("/api/auth/supabase/magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = (await response.json().catch(() => ({}))) as MagicLinkResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Magic link request failed. Try again.");
  }

  return { ok: true as const };
}

function resolveLoginError(errorCode?: string): string | null {
  if (errorCode === "auth_not_configured") {
    return "Auth is not configured for this environment.";
  }
  if (errorCode === "auth_callback_failed") {
    return "Sign-in callback failed. Request a new link and open it in this browser.";
  }
  return null;
}

export default function LoginClient({
  mockAllowed,
  supabaseEnabled,
  oauthProvider,
  errorCode,
}: LoginClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const loginError = resolveLoginError(errorCode);

  const mockMutation = useMutation({
    mutationFn: async () => startMockSession(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/onboarding");
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async () => requestSupabaseMagicLink(email),
  });

  return (
    <AppShell title="닫힌 문 앞에서" eyebrow="login">
      <Card>
        {supabaseEnabled ? (
          <>
            <p className="text-sm text-foreground/60">
              Closed alpha staging login. Do not use production credentials.
            </p>
            <p className="mt-3 text-lg leading-8 text-foreground/75">
              Staging Supabase sign-in for smoke tests. Use a staging test account only.
            </p>
            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                magicLinkMutation.mutate();
              }}
            >
              <label className="block text-sm text-foreground/70" htmlFor="staging-email">
                Email (magic link)
              </label>
              <input
                id="staging-email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
                placeholder="you@staging.example"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={magicLinkMutation.isPending}
              />
              <Button className="w-full" type="submit" disabled={magicLinkMutation.isPending || !email.trim()}>
                {magicLinkMutation.isPending ? "Sending link…" : "Send magic link"}
              </Button>
            </form>
            {magicLinkMutation.isSuccess ? (
              <p className="mt-3 text-sm text-foreground/70">
                Check your inbox and open the newest link in this same browser.
              </p>
            ) : null}
            {oauthProvider ? (
              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-foreground/15 px-4 py-3 text-sm font-medium hover:bg-foreground/5"
                href={`/api/auth/supabase/oauth?provider=${encodeURIComponent(oauthProvider)}`}
              >
                Continue with {oauthProvider}
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-lg leading-8 text-foreground/75">
            알파 기간에는 초대 링크를 받은 사람만 들어와요. 지금은 세션을 열고 첫 질문으로 바로 이동합니다.
          </p>
        )}

        {mockAllowed ? (
          <Button
            className={`mt-6 w-full ${supabaseEnabled ? "bg-foreground/10 text-foreground hover:bg-foreground/15" : ""}`}
            onClick={() => mockMutation.mutate()}
            disabled={mockMutation.isPending}
          >
            {mockMutation.isPending ? "문 여는 중" : "Dev mock session"}
          </Button>
        ) : null}

        {!mockAllowed && !supabaseEnabled ? (
          <p className="mt-4 text-sm text-danger">Supabase Auth is required in this environment.</p>
        ) : null}

        {loginError ? <p className="mt-3 text-sm text-danger">{loginError}</p> : null}
        {mockMutation.isError ? (
          <p className="mt-3 text-sm text-danger">{(mockMutation.error as Error).message}</p>
        ) : null}
        {magicLinkMutation.isError ? (
          <p className="mt-3 text-sm text-danger">{(magicLinkMutation.error as Error).message}</p>
        ) : null}

        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/">
          Back to home
        </Link>
      </Card>
    </AppShell>
  );
}
