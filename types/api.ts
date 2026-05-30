export type ApiVerdict = "PASS" | "REVIEW" | "REJECT" | "ERROR";

export type ApiError = {
  message: string;
  status?: number;
};

export type UnlockStatus = {
  profileId: string;
  unlocked: boolean;
  verdict?: ApiVerdict;
};

export type ReportTargetType = "profile" | "message" | "answer";
