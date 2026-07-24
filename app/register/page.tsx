"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signUpWithEmailPassword } from "@/app/login/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/alpha/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: inviteCode }),
      });
      if (!response.ok) {
        throw new Error("Invite claim failed");
      }
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async () => {
      await claimMutation.mutateAsync();
      await signUpWithEmailPassword(name, email, password);
    },
    onSuccess: () => {
      router.push("/onboarding");
    },
  });

  return (
    <AppShell title="초대 확인" eyebrow="register">
      <Card>
        <p className="text-sm text-foreground/60">
          Closed alpha registration requires a founder-issued invite code.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            signUpMutation.mutate();
          }}
        >
          <input
            type="text"
            placeholder="Invite code"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="text"
            placeholder="Display name"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password (min 10 chars)"
            autoComplete="new-password"
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            className="w-full"
            type="submit"
            disabled={
              signUpMutation.isPending ||
              !inviteCode.trim() ||
              !email.trim() ||
              password.length < 10
            }
          >
            {signUpMutation.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        {signUpMutation.isError ? (
          <p className="mt-3 text-sm text-danger">{(signUpMutation.error as Error).message}</p>
        ) : null}
        <Link className="mt-6 inline-block text-sm text-foreground/60 underline" href="/login">
          Back to sign in
        </Link>
      </Card>
    </AppShell>
  );
}
