import { sanitizeUtm, type ClientEvent } from "./policy";
export function currentUtm() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeUtm(Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].flatMap(key => params.has(key) ? [[key, params.get(key)]] : [])));
}
export function trackFunnel(event: ClientEvent) {
  // No storage IDs, email, full URL or referrer in analytics payloads.
  // Existing same-origin security cookies permit protected Preview verification;
  // the analytics handler never reads or stores them. No tracking cookie is set.
  void fetch("/api/acquisition", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, utm: currentUtm() }), keepalive: true }).catch(() => undefined);
}
