import { PaddleSandboxProvider } from "./payment-provider.mts";

export function loadPaymentConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.B2C_PAYMENT_MODE !== "sandbox") throw new Error("B2C_PAYMENT_MODE=sandbox is required");
  const origin = env.B2C_ORIGIN ?? "";
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== "https:" || url.hostname === "unstandard.app" ||
    url.hostname.endsWith(".unstandard.app") || /^unstandard-m9qj(?:-|\.)/.test(url.hostname)) {
    throw new Error("An isolated B2C HTTPS origin is required");
  }
  const clientToken = env.B2C_PADDLE_CLIENT_TOKEN ?? "";
  const tokenKey = env.B2C_PAYMENT_TOKEN_KEY ?? "";
  if (!/^test_[a-z0-9]+$/i.test(clientToken) || !/^[a-f0-9]{64}$/i.test(tokenKey)) {
    throw new Error("A Sandbox client token and 32-byte payment token key are required");
  }
  const checkoutUrl = `${origin}/checkout`;
  const provider = new PaddleSandboxProvider({
    apiKey: env.B2C_PADDLE_API_KEY ?? "", priceId: env.B2C_PADDLE_PRICE_ID ?? "",
    platformSecret: env.B2C_PADDLE_WEBHOOK_SECRET ?? "",
    simulatorSecret: env.B2C_PADDLE_SIMULATOR_SECRET ?? "", checkoutUrl,
  });
  return { origin, provider, tokenKey, clientToken, checkoutUrl };
}
