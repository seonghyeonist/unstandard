import type { ApiVerdict } from "@/types/api";

const copy: Record<ApiVerdict, { title: string; className: string }> = {
  PASS: { title: "이 사람의 세계가 보이기 시작해요.", className: "text-success bg-success/10" },
  REVIEW: { title: "조금 더 당신답게 적어볼까요?", className: "text-warn bg-warn/10" },
  REJECT: { title: "너무 짧아서 아직 잘 보이지 않아요.", className: "text-danger bg-danger/10" },
  ERROR: { title: "잠깐 멈췄어요. 다시 시도해주세요.", className: "text-danger bg-danger/10" },
};

export function VerdictMessage({ verdict }: { verdict?: ApiVerdict }) {
  if (!verdict) return null;
  const item = copy[verdict];
  return <p className={`rounded-2xl px-4 py-3 text-sm font-bold ${item.className}`}>{item.title}</p>;
}
