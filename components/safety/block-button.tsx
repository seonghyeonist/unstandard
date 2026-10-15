"use client";

import { useMutation } from "@tanstack/react-query";

export function BlockButton({
  targetProfileId,
  onBlocked,
}: {
  targetProfileId: string;
  onBlocked: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: targetProfileId }),
      });
      const body = await response.json().catch(() => ({})) as { blocked?: unknown };
      if (!response.ok || body.blocked !== true) throw new Error("BLOCK_FAILED");
    },
    onSuccess: onBlocked,
  });

  return (
    <div className="space-y-2 text-center">
      <button
        className="text-xs font-semibold text-foreground/50 underline"
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isSuccess || mutation.isPending}
      >
        {mutation.isSuccess ? "차단했어요" : "이 사용자 차단"}
      </button>
      {mutation.isError ? (
        <p className="text-xs text-foreground/60" role="alert">차단을 완료하지 못했어요. 다시 시도해 주세요.</p>
      ) : null}
    </div>
  );
}
