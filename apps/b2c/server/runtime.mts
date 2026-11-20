import type { HttpRequest } from "./request.mts";
import { connectDatabase } from "../db/client.mts";
import { createAppHandler } from "./http.mts";
import { loadPaymentConfig } from "./payment-config.mts";
import { createPaymentHandler } from "./payment-http.mts";
import { createPayments } from "./payments.mts";
import { createRepository } from "./repository.mts";

export function createRuntime(env: NodeJS.ProcessEnv, platformIp?: (req: HttpRequest) => string | undefined) {
  const origin = env.B2C_ORIGIN;
  if (!origin) throw new Error("B2C_ORIGIN is required");
  const settings = env.B2C_PAYMENT_MODE ? loadPaymentConfig(env) : null;
  if (platformIp && !settings) throw new Error("Sandbox config required for the isolated hosted runtime");
  const { pool, db } = connectDatabase(env);
  const payment = settings ? createPayments(db, settings.provider, settings.tokenKey, origin) : null;
  const handler = createAppHandler(createRepository(db), origin, {
    serveStatic: !platformIp,
    payment: payment ? createPaymentHandler(payment, origin, platformIp) : undefined,
    clientToken: settings?.clientToken,
  });
  return { pool, handler };
}
