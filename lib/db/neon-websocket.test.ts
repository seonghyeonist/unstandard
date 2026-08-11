import assert from "node:assert/strict";
import { describe, it } from "node:test";
import WebSocket from "ws";
import { neonWebSocketConstructorForEnv } from "./neon-websocket";

describe("Neon WebSocket transport", () => {
  it("keeps direct WebSocket behavior without proxy environment variables", () => {
    assert.equal(neonWebSocketConstructorForEnv({}), WebSocket);
  });

  it("uses a proxy-aware WebSocket constructor when WSS_PROXY is present", () => {
    const Constructor = neonWebSocketConstructorForEnv({
      WSS_PROXY: "http://127.0.0.1:8080",
    });

    assert.notEqual(Constructor, WebSocket);
    const prototype = (Constructor as unknown as { prototype: object }).prototype;
    assert.equal(prototype instanceof WebSocket, true);
  });
});
