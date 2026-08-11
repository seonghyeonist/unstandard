import { HttpsProxyAgent } from "https-proxy-agent";
import WebSocket from "ws";
import { neonConfig, type WebSocketConstructor } from "@neondatabase/serverless";

/**
 * Configure Neon session/transaction transport for Node runtimes.
 *
 * Restricted CI runners commonly expose outbound WebSocket access through an
 * HTTP CONNECT proxy. The `ws` package does not consume proxy environment
 * variables automatically, so opt into the proxy only when one is present.
 * Vercel and ordinary Node runtimes without these variables retain the direct
 * WebSocket behavior.
 */
export function neonWebSocketConstructorForEnv(
  env: { WSS_PROXY?: string; HTTPS_PROXY?: string } = {
    WSS_PROXY: process.env.WSS_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
  },
): WebSocketConstructor {
  const proxyUrl = env.WSS_PROXY?.trim() || env.HTTPS_PROXY?.trim();

  if (!proxyUrl) {
    return WebSocket;
  }

  const agent = new HttpsProxyAgent(proxyUrl);

  class ProxyWebSocket extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols, { agent });
    }
  }

  return ProxyWebSocket;
}

export function configureNeonWebSocket(): void {
  neonConfig.webSocketConstructor = neonWebSocketConstructorForEnv();
}
