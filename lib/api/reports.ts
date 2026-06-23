import type { ReportTargetType } from "@/types/api";

export type ReportResult = {
  ok: true;
  id: string;
};

export async function reportTarget(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<ReportResult> {
  const response = await fetch("/api/reports", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId, reason }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Report failed");
  }

  return response.json();
}
