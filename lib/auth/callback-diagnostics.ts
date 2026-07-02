export type AuthCallbackLog = Record<string, string | boolean | number | null | undefined>;

export function safeAuthCallbackLog(payload: AuthCallbackLog): void {
  try {
    console.info(JSON.stringify(payload));
  } catch {
    // Diagnostics must never break the callback route.
  }
}

export function getRequestHostInfo(request: Request): {
  requestHost: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
} {
  return {
    requestHost: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  };
}

/** Detects auth error markers in the request URL. Server HTTP requests never include fragments. */
export function hasAuthErrorInRequestUrl(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl);
    if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
      return true;
    }
    return Boolean(url.hash && url.hash.length > 1);
  } catch {
    return false;
  }
}

export function getRedirectOriginHostLabel(request: Request): string | null {
  try {
    const { origin } = new URL(request.url);
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export type SafeAuthErrorFields = {
  errorName: string | null;
  errorMessage: string | null;
  errorStatus: number | null;
  errorCode: string | null;
};

export function extractSafeAuthErrorFields(error: unknown): SafeAuthErrorFields {
  const result: SafeAuthErrorFields = {
    errorName: null,
    errorMessage: null,
    errorStatus: null,
    errorCode: null,
  };

  if (!error || typeof error !== "object") {
    return result;
  }

  const record = error as Record<string, unknown>;

  if (typeof record.name === "string") {
    result.errorName = record.name;
  }
  if (typeof record.message === "string") {
    result.errorMessage = record.message;
  }
  if (typeof record.status === "number") {
    result.errorStatus = record.status;
  } else if (typeof record.status === "string" && record.status.trim()) {
    const parsed = Number(record.status);
    if (!Number.isNaN(parsed)) {
      result.errorStatus = parsed;
    }
  }
  if (typeof record.code === "string") {
    result.errorCode = record.code;
  }

  return result;
}
