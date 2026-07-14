const SECRETISH_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  {
    name: "uuid",
    pattern:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  },
  { name: "database_url", pattern: /postgres(?:ql)?:\/\//i },
  { name: "bearer", pattern: /Bearer\s+[A-Za-z0-9._-]+/i },
  { name: "authorization_header", pattern: /"authorization"\s*:/i },
  { name: "set_cookie", pattern: /set-cookie/i },
  { name: "session_cookie", pattern: /better-auth\.session_token/i },
  { name: "password_field", pattern: /"password"\s*:/i },
  { name: "cookie_header", pattern: /"cookie"\s*:\s*"[^"]+"/i },
  { name: "invite_code_field", pattern: /"inviteCode"\s*:/i },
  { name: "bypass_secret", pattern: /x-vercel-protection-bypass/i },
  { name: "query_secret", pattern: /\?[^=]+=/ },
];

/**
 * Recursive defense-in-depth scan. Artifacts must be built from safe fields first;
 * this rejects accidental secret leakage in serialized output.
 */
export function scanForSecrets(value: unknown, path = "$"): string[] {
  const failures: string[] = [];

  if (value === null || value === undefined) {
    return failures;
  }

  if (typeof value === "string") {
    for (const { name, pattern } of SECRETISH_PATTERNS) {
      if (pattern.test(value)) {
        failures.push(`${path}: refused secret-like ${name}`);
      }
    }
    return failures;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return failures;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      failures.push(...scanForSecrets(item, `${path}[${index}]`));
    });
    return failures;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("password") ||
        lower.includes("cookie") ||
        lower.includes("token") ||
        lower.includes("authorization") ||
        lower.includes("secret") ||
        lower === "email" ||
        lower.includes("databaseurl") ||
        lower.includes("connectionstring")
      ) {
        failures.push(`${path}.${key}: forbidden field name`);
      }
      failures.push(...scanForSecrets(child, `${path}.${key}`));
    }
  }

  return failures;
}
