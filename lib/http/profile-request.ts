// Do not parse or echo unbounded request bodies (especially unsolicited identity data).
export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Host is browser-facing behind Next's reverse proxy; request.url may be internal.
  // Browsers cannot set Host independently of the destination receiving cookies.
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const local = host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:");
  const requestOrigin = `${local ? url.protocol : "https:"}//${host}`;
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === requestOrigin && fetchSite !== "cross-site";
}
export async function readBoundedBody(request: Pick<Request, "body">, maxBytes = 2048): Promise<Uint8Array> {
  if (!request.body) throw new Error("Invalid body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new Error("Invalid body"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { reader.releaseLock(); }
}

export async function readSmallJson(request: Pick<Request, "headers" | "body">, maxBytes = 2048): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new Error("Invalid body");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedBody(request, maxBytes)));
}
