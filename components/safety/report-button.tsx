"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { reportTarget } from "@/lib/api/reports";
import type { ReportTargetType } from "@/types/api";

export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: () => reportTarget(targetType, targetId, "closed_alpha_safety_check"),
    onSuccess: () => setSent(true),
  });

  return (
    <button className="text-xs font-semibold text-foreground/50 underline" onClick={() => mutation.mutate()} disabled={sent || mutation.isPending}>
      {sent ? "알려줘서 고마워요" : "불편한 내용 신고"}
    </button>
  );
}
