import { createServer } from "node:http";
import { createRuntime } from "./runtime.mts";
import { hasSandboxAccess, polarWebhookPath, sandboxAuthChallenge } from "./sandbox-access.mts";

const port = Number(process.env.PORT ?? 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");

const host = process.env.B2C_BIND_HOST ?? "127.0.0.1";
if (host !== "127.0.0.1" && host !== "0.0.0.0") throw new Error("Invalid B2C_BIND_HOST");
const publicBind = host === "0.0.0.0";
const accessKey = process.env.B2C_SANDBOX_ACCESS_KEY;
const revision = process.env.RENDER_GIT_COMMIT ?? process.env.B2C_REVISION;
if (publicBind && (process.env.B2C_PAYMENT_MODE !== "sandbox" ||
    !accessKey || !/^[a-f0-9]{64}$/i.test(accessKey) ||
    !process.env.B2C_ORIGIN?.startsWith("https://"))) {
  throw new Error("Sandbox HTTPS origin and access key are required for a public bind");
}

const { pool, handler } = createRuntime(process.env);
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    if (revision && /^[a-f0-9]{40}$/.test(revision)) res.setHeader("X-B2C-Revision", revision);
    res.writeHead(204, { "Cache-Control": "no-store" }).end();
    return;
  }
  if (publicBind && req.url !== polarWebhookPath && !hasSandboxAccess(accessKey, req.headers.authorization)) {
    res.writeHead(401, {
      "Cache-Control": "no-store",
      "WWW-Authenticate": sandboxAuthChallenge,
    }).end();
    return;
  }
  void handler(req, res);
});
server.listen(port, host, () => console.info("b2c_server_listening"));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exitCode = 1;
    }, 8_000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      void pool.end().catch(() => { process.exitCode = 1; });
    });
  });
}
