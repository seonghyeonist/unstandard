import type { ApiVerdict } from "@/types/api";
import { verdictCopy } from "@/lib/depth/verdict-copy";

const ERROR_COPY = {
  title: "잠깐 멈췄어요. 다시 시도해주세요.",
  description: "네트워크가 잠시 흔들렸어요. 같은 답을 한 번만 더 보내볼까요?",
};

const className: Record<ApiVerdict, string> = {
  PASS: "text-success bg-success/10",
  REVIEW: "text-warn bg-warn/10",
  REJECT: "text-danger bg-danger/10",
  ERROR: "text-danger bg-danger/10",
};

export function VerdictMessage({ verdict, reasonCodes }: { verdict?: ApiVerdict; reasonCodes?: string[] }) {
  if (!verdict) return null;

  const copy =
    verdict === "ERROR" ? ERROR_COPY : verdictCopy({ verdict, reasonCodes: reasonCodes ?? [] });

  return (
    <div className={`rounded-2xl px-4 py-3 ${className[verdict]}`}>
      <p className="text-sm font-bold">{copy.title}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{copy.description}</p>
    </div>
  );
}
