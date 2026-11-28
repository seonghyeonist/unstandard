import { timingSafeEqual } from "node:crypto";

export const polarWebhookPath = "/api/b2c/webhooks/polar";
export const sandboxAuthChallenge = 'Basic realm="UNSTANDARD Sandbox"';

export function hasSandboxAccess(token: string | undefined, authorization: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token) || !authorization) return false;
  const expected = Buffer.from("Basic " + Buffer.from("b2c:" + token).toString("base64"));
  const received = Buffer.from(authorization);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
