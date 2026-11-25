import { createFetchAdapter } from "../../server/fetch-adapter.mts";
import { createRuntime } from "../../server/runtime.mts";

import { hasSandboxAccess, polarWebhookPath, sandboxAuthChallenge } from "../../server/sandbox-access.mts";
let fetchRequest: ReturnType<typeof createFetchAdapter> | undefined;

function response(status: number, error: string, extra: Record<string, string> = {}) {
  return Response.json({ error }, {
    status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...extra },
  });
}

const handler = {
  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      if (url.origin !== process.env.B2C_ORIGIN) return response(404, "not_found");
      if (url.pathname !== polarWebhookPath) {
        const token = process.env.B2C_SANDBOX_ACCESS_KEY ?? "";
        if (!/^[a-f0-9]{64}$/i.test(token)) return response(503, "sandbox_access_unavailable");
        if (!hasSandboxAccess(token, request.headers.get("authorization") ?? undefined)) {
          return response(401, "sandbox_access_required", { "WWW-Authenticate": sandboxAuthChallenge });
        }
      }
      fetchRequest ??= createFetchAdapter(createRuntime(process.env, (req) => {
        const platformIp = req.headers["x-forwarded-for"];
        return typeof platformIp === "string" ? platformIp : undefined;
      }).handler);
      return await fetchRequest(request);
    } catch {
      console.error("b2c_vercel_runtime_failed");
      return response(503, "temporarily_unavailable");
    }
  },
};

export default handler;
