// These are declared attribution labels, never evidence of a verified referrer.
export const CLIENT_EVENTS = ["landing_view", "alpha_cta_click", "waitlist_form_view", "waitlist_submit_attempt", "waitlist_submit_error"] as const;
export type ClientEvent = typeof CLIENT_EVENTS[number];
export type FunnelEvent = ClientEvent | "waitlist_submit_accepted" | "waitlist_created";
export type Attribution = { channel: string; campaign: string; content: string };
const allowed = {
  utm_source: ["instagram", "everytime"],
  utm_medium: ["paid_social", "organic_social", "social"],
  utm_campaign: ["alpha_recruitment"],
  utm_content: ["reel_a", "reel_b", "post_a", "post_b"],
} as const;
export function sanitizeUtm(value: unknown): Record<string, string> {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(allowed).map(([key, values]) => {
    const raw = input[key];
    const safe = typeof raw === "string" && raw.length <= 40 && (["none", "unknown", ...values] as readonly string[]).includes(raw) ? raw : raw === undefined || raw === "" ? "none" : "unknown";
    return [key, safe];
  }));
}
export function attributionFrom(value: unknown): Attribution {
  const utm = sanitizeUtm(value);
  const channel = utm.utm_source === "instagram" && utm.utm_medium === "paid_social" ? "instagram_paid"
    : utm.utm_source === "instagram" && ["organic_social", "social"].includes(utm.utm_medium) ? "instagram_organic"
    : utm.utm_source === "everytime" && ["organic_social", "social"].includes(utm.utm_medium) ? "everytime"
    : Object.values(utm).every(x => x === "none") ? "direct_or_unattributed" : "other_unknown";
  return { channel, campaign: utm.utm_campaign, content: utm.utm_content };
}
export function validateClientEvent(value: unknown): { event: ClientEvent; attribution: Attribution } {
  if (!value || typeof value !== "object") throw new Error("INVALID_EVENT");
  const input = value as Record<string, unknown>;
  if (!(CLIENT_EVENTS as readonly unknown[]).includes(input.event)) throw new Error("INVALID_EVENT");
  return { event: input.event as ClientEvent, attribution: attributionFrom(input.utm) };
}

// Next may construct request.url with an internal host; Host is the browser-facing
// authority. This check blocks browser cross-origin writes, not nonbrowser spoofing.
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  return origin === `https://${host}` || origin === `http://${host}`;
}
