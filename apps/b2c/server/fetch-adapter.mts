import type { HttpRequest, HttpResponse } from "./request.mts";

export function createFetchAdapter(handle: (req: HttpRequest, res: HttpResponse) => Promise<void>) {
  return async function fetchRequest(request: Request) {
    const url = new URL(request.url);
    const req: HttpRequest = {
      url: url.pathname + url.search,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      socket: {},
      async *iterator() {
        const reader = request.body?.getReader();
        if (!reader) return;
        let complete = false;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) { complete = true; return; }
            yield Buffer.from(part.value);
          }
        } finally {
          if (!complete) void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      },
    };
    let status = 500;
    let body: Uint8Array<ArrayBuffer> | null = null;
    const headers = new Headers();
    const res: HttpResponse = {
      get headersSent() { return status !== 500; },
      setHeader(name, value) { headers.set(name, value); },
      writeHead(code, values) {
        status = code;
        for (const [name, value] of Object.entries(values)) headers.set(name, value);
      },
      end(value) {
        if (value !== undefined) body = Uint8Array.from(Buffer.from(value));
      },
    };
    await handle(req, res);
    return new Response(body, { status, headers });
  };
}
