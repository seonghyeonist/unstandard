export const apiOrigin = "https://sandbox-api.paddle.com";
export const events = ["adjustment.created", "adjustment.updated", "transaction.completed"];

export class Blocked extends Error {}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Blocked(`missing_${name}`);
  return value;
}
export function sandboxOrigin() {
  const origin = required("B2C_ORIGIN");
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== "https:" || url.hostname === "unstandard.app" ||
    url.hostname.endsWith(".unstandard.app") || /^unstandard-m9qj(?:-|\.)/.test(url.hostname)) {
    throw new Error("isolated_https_origin_required");
  }
  return origin;
}
export function allowWrites(action: string) {
  if (required("B2C_SANDBOX_WRITE_CONFIRM") !== action) throw new Blocked("sandbox_write_confirmation_required");
}
export function paddleApi(keyName: string) {
  const key = required(keyName);
  if (!/^pdl_sdbx_apikey_[a-z0-9_]+$/i.test(key)) throw new Error("sandbox_key_required");
  async function request<T>(path: string, method = "GET", body?: unknown) {
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin || url.username || url.password) throw new Error("invalid_sandbox_api_url");
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Paddle-Version": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 401 || response.status === 403) throw new Blocked("sandbox_api_credentials_or_permission");
    if (!response.ok) throw new Error(`sandbox_http_${response.status}`);
    return await response.json() as { data: T; meta?: { pagination?: { next?: string; has_more?: boolean } } };
  }
  async function one<T>(path: string, method?: string, body?: unknown) { return (await request<T>(path, method, body)).data; }
  async function list<T>(path: string) {
    const result: T[] = [];
    let page: string | undefined = path;
    for (let count = 0; count < 20 && page; count++) {
      const reply: Awaited<ReturnType<typeof request<T[]>>> = await request<T[]>(page);
      result.push(...reply.data);
      page = reply.meta?.pagination?.has_more ? reply.meta.pagination.next : undefined;
      if (reply.meta?.pagination?.has_more && !page) throw new Error("sandbox_pagination_invalid");
    }
    if (page) throw new Error("sandbox_pagination_limit");
    return result;
  }
  return { one, list };
}

export async function summarize(layer: string, run: () => Promise<Record<string, unknown>>) {
  try {
    const data = await run();
    console.log(JSON.stringify({ layer, status: "PASS", ...data }));
  } catch (error) {
    const status = error instanceof Blocked ? "BLOCKED" : "FAIL";
    // Only stable codes may reach evidence. Browser/DB/SDK errors can contain private request data.
    const reason = error instanceof Error && /^(?:[a-z_0-9]{3,100}|missing_[A-Z_0-9]{3,100})$/.test(error.message)
      ? error.message : "operation_failed";
    console.log(JSON.stringify({ layer, status, reason }));
    process.exitCode = status === "BLOCKED" ? 78 : 1;
  }
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
