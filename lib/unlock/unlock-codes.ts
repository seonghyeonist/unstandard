export const UNLOCK_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_BODY",
  "INVALID_PROFILE_ID",
  "PROFILE_NOT_FOUND",
  "PROFILE_NOT_ONBOARDED",
  "PROFILE_SETUP_REQUIRED",
  "SELF_UNLOCK_NOT_ALLOWED",
  "QUESTION_NOT_CONFIGURED",
  "EVALUATION_FAILED",
  "PERSISTENCE_FAILED",
  "UNLOCK_SERVICE_UNAVAILABLE",
] as const;

export type UnlockErrorCode = (typeof UNLOCK_ERROR_CODES)[number];

export type UnlockHttpStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 500
  | 503;

export function unlockErrorHttpStatus(code: UnlockErrorCode): UnlockHttpStatus {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_BODY":
    case "INVALID_PROFILE_ID":
      return 400;
    case "SELF_UNLOCK_NOT_ALLOWED":
      return 403;
    case "PROFILE_NOT_FOUND":
      return 404;
    case "PROFILE_SETUP_REQUIRED":
    case "PROFILE_NOT_ONBOARDED":
    case "QUESTION_NOT_CONFIGURED":
      return 409;
    case "UNLOCK_SERVICE_UNAVAILABLE":
      return 503;
    case "EVALUATION_FAILED":
    case "PERSISTENCE_FAILED":
    default:
      return 500;
  }
}

export function unlockErrorClientMessage(code: UnlockErrorCode): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "로그인 상태가 만료됐어요. 다시 로그인해주세요.";
    case "INVALID_BODY":
    case "INVALID_PROFILE_ID":
      return "제출한 답변 형식을 확인해주세요.";
    case "PROFILE_NOT_FOUND":
      return "이 프로필을 더 이상 찾을 수 없어요.";
    case "PROFILE_SETUP_REQUIRED":
    case "PROFILE_NOT_ONBOARDED":
      return "아직 열 수 없는 프로필이에요.";
    case "SELF_UNLOCK_NOT_ALLOWED":
      return "내 프로필은 열쇠 질문으로 열 수 없어요.";
    case "QUESTION_NOT_CONFIGURED":
      return "열쇠 질문이 아직 준비되지 않았어요.";
    case "UNLOCK_SERVICE_UNAVAILABLE":
      return "현재 열쇠 기능을 사용할 수 없어요. 잠시 뒤 다시 시도해주세요.";
    case "EVALUATION_FAILED":
    case "PERSISTENCE_FAILED":
    default:
      return "열쇠 확인 중 문제가 생겼어요. 잠시 뒤 다시 시도해주세요.";
  }
}
