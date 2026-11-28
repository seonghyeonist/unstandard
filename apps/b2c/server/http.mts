import { createServer } from "node:http";
import type { HttpRequest, HttpResponse } from "./request.mts";
import { readFile } from "node:fs/promises";
import type { Repository } from "./repository.mts";
import { readSessionCookie } from "./session.mts";
import { json } from "./response.mts";
import type { createPaymentHandler } from "./payment-http.mts";
import { serveCheckout } from "./checkout.mts";

const root = new URL("../dist/", import.meta.url);
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ...["client", "copy", "receipt", "view"].map((name) =>
    ["/" + name + ".mjs", [name + ".mjs", "text/javascript; charset=utf-8"]] as [string, string[]]),
]);
const roomPath = /^\/api\/b2c\/rooms\/([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})(\/me)?$/i;

async function readUpdate(req: HttpRequest) {
  if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
    return {status: 415} as const;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    bytes += chunk.length;
    if (bytes > 1024) return {status: 413} as const;
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {status: 400} as const;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {status: 422} as const;
  const {locale, revision} = value as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || (locale !== "en" && locale !== "ko") ||
      typeof revision !== "number" || !Number.isInteger(revision) || revision < 0 || revision >= 2_147_483_647) {
    return {status: 422} as const;
  }
  return {status: 200, locale, revision} as const;
}

type AppOptions = {
  payment?: ReturnType<typeof createPaymentHandler>;
  serveStatic?: boolean;
};

export function createAppHandler(repository: Repository, origin: string, options: AppOptions = {}) {
  const expectedOrigin = new URL(origin);
  const loopbackHttp = expectedOrigin.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(expectedOrigin.hostname);
  if (expectedOrigin.origin !== origin || (expectedOrigin.protocol !== "https:" && !loopbackHttp)) {
    throw new Error("B2C_ORIGIN must be an exact HTTPS origin or a loopback HTTP origin");
  }

  return async (req: HttpRequest, res: HttpResponse) => {
    const path = req.url?.split("?", 1)[0] ?? "";
    try {
      const page = path === "/api/b2c/checkout" ? "/checkout" : path === "/api/b2c/recover" ? "/recover" : path;
      if (options.payment && serveCheckout(req, res, page)) return;
      if (options.payment && await options.payment(req, res, path)) return;
      const asset = options.serveStatic === false ? undefined : assets.get(path);
      if (asset && (req.method === "GET" || req.method === "HEAD")) {
        const [name, contentType] = asset;
        const file = await readFile(new URL(name, root));
        res.writeHead(200, {"Content-Type": contentType, "X-Content-Type-Options": "nosniff"});
        res.end(req.method === "HEAD" ? undefined : file);
        return;
      }

      const match = roomPath.exec(path);
      const cardPath = path === "/api/b2c/me/card";
      if (!match && !cardPath) return json(res, 404, {error: "not_found"});
      const isWrite = Boolean(match?.[2]);
      if (req.method !== (isWrite ? "PATCH" : "GET")) {
        res.setHeader("Allow", isWrite ? "PATCH" : "GET");
        return json(res, 405, {error: "method_not_allowed"});
      }
      if (isWrite && req.headers.origin !== expectedOrigin.origin) return json(res, 403, {error: "origin"});
      const digest = readSessionCookie(req.headers.cookie);
      if (!digest) return json(res, 401, {error: "unauthenticated"});

      if (isWrite && match) {
        const input = await readUpdate(req);
        if (input.status === 413) res.setHeader("Connection", "close");
        if (input.status !== 200) return json(res, input.status, {error: "invalid_input"});
        const result = await repository.access(digest, {
          type: "locale", roomId: match[1].toLowerCase(), locale: input.locale, revision: input.revision,
        });
        return json(res, result.status, result.body);
      }

      const result = await repository.access(digest, match ? {type: "room", roomId: match[1].toLowerCase()} : {type: "card"});
      return json(res, result.status, result.body);
    } catch {
      console.error("b2c_request_failed");
      if (!res.headersSent) json(res, 503, {error: "temporarily_unavailable"});
    }
  };
}

export function createAppServer(repository: Repository, origin: string, options: AppOptions = {}) {
  return createServer(createAppHandler(repository, origin, options));
}
