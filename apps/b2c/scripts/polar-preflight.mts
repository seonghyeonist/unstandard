import { loadPaymentConfig } from "../server/payment-config.mts";
import { Blocked, required, summarize } from "./sandbox-helpers.mts";

await summarize("polar_sandbox_preflight", async () => {
  for (const key of ["B2C_PAYMENT_MODE", "B2C_ORIGIN", "B2C_PAYMENT_TOKEN_KEY", "B2C_POLAR_ACCESS_TOKEN",
    "B2C_POLAR_ORGANIZATION_ID", "B2C_POLAR_PRODUCT_ID", "B2C_POLAR_WEBHOOK_SECRET"]) required(key);
  const { provider } = loadPaymentConfig(process.env, true);
  try {
    await provider.validateCatalog();
  } catch (error) {
    if (error instanceof Error && "statusCode" in error && [401, 403].includes(Number(error.statusCode))) {
      throw new Blocked("sandbox_api_credentials_or_permission");
    }
    throw error;
  }
  return { catalog: "USD_899_one_time", environment: "sandbox" };
});
