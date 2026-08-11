import { isDatabaseAuthConfigured } from "@/lib/config/runtime-mode";

export function isProductionAuthConfigured(): boolean {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV) {
    return true;
  }
  return isDatabaseAuthConfigured();
}

export function assertProductionAuthConfigured(): void {
  if (!isProductionAuthConfigured()) {
    throw new Error(
      "Production requires DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL",
    );
  }
}
