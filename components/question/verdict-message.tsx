import type { ApiVerdict } from "@/types/api";
import { verdictCopy } from "@/lib/depth/verdict-copy";
import { unlockErrorClientMessage, type UnlockErrorCode } from "@/lib/unlock/unlock-codes";

const NETWORK_COPY = {
  title: "잠깐 멈췄어요. 다시 시도해주세요.",
  description: "네트워크가 잠시 흔들렸어요. 같은 답을 한 번만 더 보내볼까요?",
};

const className: Record<ApiVerdict, string> = {
  PASS: "text-success bg-success/10",
  REVIEW: "text-warn bg-warn/10",
  REJECT: "text-danger bg-danger/10",
  ERROR: "text-danger bg-danger/10",
};

function isUnlockErrorCode(code: string | undefined): code is UnlockErrorCode {
  return Boolean(
    code &&
      [
        "UNAUTHORIZED",
        "INVALID_BODY",
        "INVALID_PROFILE_ID",
        "PROFILE_NOT_FOUND",
        "PROFILE_NOT_ONBOARDED",
        "SELF_UNLOCK_NOT_ALLOWED",
        "QUESTION_NOT_CONFIGURED",
        "EVALUATION_FAILED",
        "PERSISTENCE_FAILED",
        "UNLOCK_SERVICE_UNAVAILABLE",
      ].includes(code),
  );
}

export function VerdictMessage({
  verdict,
  reasonCodes,
  errorKind,
  errorCode,
  errorMessage,
}: {
  verdict?: ApiVerdict;
  reasonCodes?: string[];
  errorKind?: "ok" | "http_error" | "network_error";
  errorCode?: string;
  errorMessage?: string;
}) {
  if (!verdict) return null;

  let copy =
    verdict === "ERROR" ? NETWORK_COPY : verdictCopy({ verdict, reasonCodes: reasonCodes ?? [] });

  if (verdict === "ERROR") {
    if (errorKind === "network_error") {
      copy = NETWORK_COPY;
    } else if (errorKind === "http_error") {
      if (errorCode === "UNAUTHORIZED" || errorCode === "HTTP_401") {
        copy = {
          title: "로그인이 필요해요.",
          description: unlockErrorClientMessage("UNAUTHORIZED"),
        };
      } else if (errorCode === "UNLOCK_SERVICE_UNAVAILABLE" || errorCode === "HTTP_503") {
        copy = {
          title: "열쇠 기능을 잠시 쓸 수 없어요.",
          description: unlockErrorClientMessage("UNLOCK_SERVICE_UNAVAILABLE"),
        };
      } else if (isUnlockErrorCode(errorCode)) {
        copy = {
          title: "잠깐 확인할게요.",
          description: errorMessage || unlockErrorClientMessage(errorCode),
        };
      } else if (errorMessage) {
        copy = {
          title: "잠깐 확인할게요.",
          description: errorMessage,
        };
      } else {
        copy = {
          title: "잠깐 확인할게요.",
          description: "요청을 처리하지 못했어요. 잠시 뒤 다시 시도해주세요.",
        };
      }
    }
  }

  return (
    <div className={`rounded-2xl px-4 py-3 ${className[verdict]}`}>
      <p className="text-sm font-bold">{copy.title}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{copy.description}</p>
    </div>
  );
}
