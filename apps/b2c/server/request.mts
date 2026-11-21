import type { IncomingHttpHeaders } from "node:http";

export type HttpRequest = {
  url?: string;
  method?: string;
  headers: IncomingHttpHeaders;
  socket: { remoteAddress?: string };
  iterator(options: { destroyOnReturn: boolean }): AsyncIterable<Buffer>;
};

export type HttpResponse = {
  readonly headersSent: boolean;
  setHeader(name: string, value: string): unknown;
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: Buffer | string): unknown;
};
