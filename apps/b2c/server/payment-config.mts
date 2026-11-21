import { PolarSandboxProvider } from "./polar-provider.mts";

export function sandboxOrigin(origin: string, local = false) {
  const url = new URL(origin);
  const loopback = local && url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.origin !== origin || (url.protocol !== "https:" && !loopback) ||
      url.hostname === "unstandard.app" || url.hostname.endsWith(".unstandard.app") ||
      /^unstandard-m9qj(?:-|\.)/.test(url.hostname)) throw new Error("isolated_b2c_origin_required");
  return origin;
}

export function loadPaymentConfig(env: NodeJS.ProcessEnv = process.env, local = false) {
  if (env.B2C_PAYMENT_MODE !== "sandbox") throw new Error("sandbox_payment_mode_required");
  const origin = sandboxOrigin(env.B2C_ORIGIN ?? "", local);
  const tokenKey = env.B2C_PAYMENT_TOKEN_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(tokenKey)) throw new Error("sandbox_payment_token_key_required");
  const provider = new PolarSandboxProvider({
    accessToken: env.B2C_POLAR_ACCESS_TOKEN ?? "",
    organizationId: env.B2C_POLAR_ORGANIZATION_ID ?? "",
    productId: env.B2C_POLAR_PRODUCT_ID ?? "",
    webhookSecret: env.B2C_POLAR_WEBHOOK_SECRET ?? "",
    origin,
  });
  return { origin, provider, tokenKey };
}
