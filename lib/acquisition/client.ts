import { sanitizeUtm, type ClientEvent } from "./policy";
export function currentUtm() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeUtm(Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].flatMap(key => params.has(key) ? [[key, params.get(key)]] : [])));
}
export function trackFunnel(event: ClientEvent) {
  // No cookies, storage IDs, email, full URL or referrer in analytics payloads.
  void fetch("/api/acquisition", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, utm: currentUtm() }), keepalive: true }).catch(() => undefined);
}
