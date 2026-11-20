import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { allowWrites, Blocked, delay, events, paddleApi, required, sandboxOrigin, summarize } from "./paddle-api.mts";

type Catalog = { id: string; name: string; status: string; custom_data?: { b2c_sku?: string } };
type Price = Catalog & { billing_cycle: unknown; trial_period: unknown; tax_mode: string;
  unit_price: { amount: string; currency_code: string }; unit_price_overrides: unknown[];
  quantity: { minimum: number; maximum: number } };
type Destination = { id: string; destination: string; traffic_source: string; active: boolean; type: string;
  subscribed_events: Array<{ name: string }>; endpoint_secret_key: string; include_sensitive_fields: boolean };
type ClientToken = { id: string; name: string; token: string; status: string };

const marker = "recontact-v4";
const tokenName = "UNSTANDARD B2C P2 Sandbox";
const productName = "UNSTANDARD B2C Recontact";
const originPath = "/api/b2c/webhooks/paddle";

function unique<T>(items: T[], component: string) {
  if (items.length > 1) throw new Error(`duplicate_${component}`);
  return items[0];
}

async function configure(provision: boolean) {
  const api = paddleApi("B2C_PADDLE_SETUP_API_KEY");
  const origin = sandboxOrigin();
  const checkout = `${origin}/checkout`;
  const secretOutput = provision ? required("B2C_PADDLE_SECRET_OUTPUT_FILE") : undefined;
  if (provision) {
    allowWrites("provision-b2c-sandbox");
    if (!secretOutput || !isAbsolute(secretOutput) || secretOutput.startsWith(process.cwd() + "/")) {
      throw new Error("private_secret_output_path_required");
    }
    // Create-only, private local handoff for the secret manager, never written to stdout.
    await writeFile(secretOutput, "", { flag: "wx", mode: 0o600 });
  }
  const [products, destinations, tokens, link, conversions] = await Promise.all([
    api.list<Catalog>("/products?status=active"),
    api.list<Destination>("/notification-settings"),
    api.list<ClientToken>("/client-tokens?status=active"),
    api.one<{ default_url: string | null }>("/settings/checkout-url"),
    api.one<Record<string, { enabled: boolean }>>("/settings/currency-conversions"),
  ]);
  if (Object.values(conversions).some((value) => typeof value?.enabled !== "boolean")) throw new Error("invalid_currency_settings");
  const enabled = Object.fromEntries(Object.entries(conversions).filter(([code, on]) => code !== "USD" && on.enabled)
    .map(([code]) => [code, { enabled: false }]));
  const conflicts: string[] = [];
  if (link.default_url && link.default_url !== checkout && process.env.B2C_PADDLE_EXPECT_PREVIOUS_CHECKOUT !== link.default_url) {
    conflicts.push("default_checkout_link");
  }
  if (Object.keys(enabled).length && process.env.B2C_PADDLE_ALLOW_ACCOUNT_SETTINGS !== "dedicated-b2c-sandbox") {
    conflicts.push("account_currency_conversion");
  }
  const product = unique(products.filter((item) => item.custom_data?.b2c_sku === marker), "product");
  if (!product && products.some((item) => item.name === productName)) conflicts.push("unmanaged_product");
  const price = product ? unique((await api.list<Price>(`/prices?status=active&product_id=${product.id}`))
    .filter((item) => item.custom_data?.b2c_sku === marker), "price") : undefined;
  const matchingPrice = (item: Price) => item.status === "active" && !item.billing_cycle && !item.trial_period &&
    item.unit_price.amount === "899" && item.unit_price.currency_code === "USD" && item.tax_mode === "external" &&
    !item.unit_price_overrides.length && item.quantity.minimum === 1 && item.quantity.maximum === 1;
  if (price && !matchingPrice(price)) conflicts.push("existing_price");
  const checkoutToken = unique(tokens.filter((item) => item.name === tokenName), "client_token");
  const dest = ["platform", "simulation"].map((source) => {
    const url = origin + originPath + (source === "simulation" ? "/simulator" : "");
    const current = unique(destinations.filter((item) => item.destination === url), "destination");
    if (current && (!current.active || current.traffic_source !== source || current.type !== "url" ||
      current.include_sensitive_fields ||
      current.subscribed_events.map((event) => event.name).sort().join() !== events.join())) conflicts.push(source + "_destination");
    return { source, url, current };
  });
  if (conflicts.length) throw new Blocked(`sandbox_config_conflict_${conflicts[0]}`);
  const missing = [!product && "product", !price && "price", !checkoutToken && "client_token",
    ...dest.filter((entry) => !entry.current).map((entry) => entry.source + "_destination"),
    link.default_url !== checkout && "checkout_url", Object.keys(enabled).length > 0 && "currency_conversion"].filter(Boolean);
  if (!provision && missing.length) throw new Blocked(`sandbox_config_missing_${missing[0]}`);
  const savedProduct = product ?? await api.one<Catalog>("/products", "POST", {
    name: productName, description: "Sandbox recontact planning fixture", tax_category: "standard",
    custom_data: { b2c_sku: marker },
  });
  const savedPrice = price ?? await api.one<Price>("/prices", "POST", {
    description: "UNSTANDARD B2C P2 USD 899 one-time", product_id: savedProduct.id, tax_mode: "external",
    unit_price: { amount: "899", currency_code: "USD" }, quantity: { minimum: 1, maximum: 1 },
    custom_data: { b2c_sku: marker },
  });
  const savedToken = checkoutToken ?? await api.one<ClientToken>("/client-tokens", "POST", { name: tokenName });
  const refs: Record<string, Destination> = {};
  for (const { source, url, current } of dest) {
    refs[source] = current ?? await api.one<Destination>("/notification-settings", "POST", {
      type: "url", description: `UNSTANDARD B2C P2 ${source}`, destination: url,
      traffic_source: source, subscribed_events: events, include_sensitive_fields: false,
    });
  }
  if (provision && link.default_url !== checkout) {
    await api.one("/settings/checkout-url", "PATCH", { default_url: checkout });
  }
  if (provision && Object.keys(enabled).length) await api.one("/settings/currency-conversions", "PATCH", enabled);
  const [catalogRead, priceRead, tokenRead, platformRead, simulatorRead, checkoutRead, currencyRead] = await Promise.all([
    api.one<Catalog>(`/products/${savedProduct.id}`), api.one<Price>(`/prices/${savedPrice.id}`),
    api.one<ClientToken>(`/client-tokens/${savedToken.id}`),
    api.one<Destination>(`/notification-settings/${refs.platform.id}`),
    api.one<Destination>(`/notification-settings/${refs.simulation.id}`),
    api.one<{ default_url: string }>("/settings/checkout-url"), api.one<Record<string, { enabled: boolean }>>("/settings/currency-conversions"),
  ]);
  if (catalogRead.status !== "active" || !matchingPrice(priceRead) || tokenRead.status !== "active" ||
    !/^test_[a-z0-9]+$/i.test(tokenRead.token) || checkoutRead.default_url !== checkout ||
    Object.entries(currencyRead).some(([code, on]) => code !== "USD" && on.enabled) ||
    !platformRead.active || !simulatorRead.active || platformRead.traffic_source !== "platform" ||
    simulatorRead.traffic_source !== "simulation" || platformRead.destination !== origin + originPath ||
    simulatorRead.destination !== origin + originPath + "/simulator" || !platformRead.endpoint_secret_key ||
    !simulatorRead.endpoint_secret_key || platformRead.endpoint_secret_key === simulatorRead.endpoint_secret_key) {
    throw new Error("sandbox_readback_mismatch");
  }
  if (secretOutput) {
    await writeFile(secretOutput, JSON.stringify({
      B2C_PADDLE_PRICE_ID: priceRead.id,
      B2C_PADDLE_CLIENT_TOKEN: tokenRead.token,
      B2C_PADDLE_WEBHOOK_SECRET: platformRead.endpoint_secret_key,
      B2C_PADDLE_SIMULATOR_SECRET: simulatorRead.endpoint_secret_key,
    }));
  }
  return { changed: missing, productId: catalogRead.id, priceId: priceRead.id,
    platformDestinationId: platformRead.id, simulatorDestinationId: simulatorRead.id };
}

async function simulate() {
  const api = paddleApi("B2C_PADDLE_SETUP_API_KEY");
  allowWrites("run-b2c-simulator");
  const origin = sandboxOrigin();
  const destination = unique((await api.list<Destination>("/notification-settings"))
    .filter((item) => item.destination === origin + originPath + "/simulator" && item.active &&
      item.traffic_source === "simulation"), "simulator_destination");
  if (!destination) throw new Blocked("simulator_destination_missing");
  type Simulation = { id: string; name: string; status: string; type: string; notification_setting_id: string };
  const saved = await api.list<Simulation>(`/simulations?notification_setting_id=${destination.id}`);
  const scenarios = [
    { type: "adjustment.updated", suffix: "", expected: 200 },
    { type: "transaction.completed", suffix: "", expected: 200 },
    { type: "adjustment.created", suffix: "", expected: 200 },
    { type: "transaction.completed", suffix: " invalid currency", expected: 422, payload: { currency_code: "EUR" } },
  ];
  const configured: Simulation[] = [];
  for (const scenario of scenarios) {
    const { type, suffix, payload } = scenario;
    const name = `UNSTANDARD B2C P2 ${type}${suffix}`;
    const existing = unique(saved.filter((item) => item.name === name && item.status === "active" &&
      item.type === type && item.notification_setting_id === destination.id), "simulation");
    configured.push(existing ?? await api.one<Simulation>("/simulations", "POST",
      { name, type, notification_setting_id: destination.id, ...(payload ? { payload } : {}) }));
  }
  const results: Array<{ scenario: string; http: number }> = [];
  for (const index of [0, 1, 1, 2, 3]) {
    const { id } = configured[index];
    const { type, suffix, expected } = scenarios[index];
    const run = await api.one<{ id: string }>(`/simulations/${id}/runs`, "POST");
    const endpoint = `/simulations/${id}/runs/${run.id}/events`;
    let received = false;
    for (let retry = 0; retry < 15; retry++) {
      const logs = await api.list<{ status: string; response: { status_code: number; body: string } | null }>(endpoint);
      const entry = logs[0];
      if (entry && entry.status !== "pending") {
        if (entry.response?.status_code !== expected) throw new Error("simulator_delivery_unexpected_http");
        const body = JSON.parse(entry.response.body) as { simulation?: boolean; error?: string };
        if (expected === 200 ? !body.simulation : body.error !== "simulation_currency_mismatch") {
          throw new Error("simulator_unexpected_response");
        }
        results.push({ scenario: type + suffix, http: entry.response.status_code });
        received = true;
        break;
      }
      await delay(2_000);
    }
    if (!received) throw new Blocked("simulator_delivery_timeout");
  }
  return { deliveries: results, settlementVerified: false };
}

const action = process.argv[2];
await summarize(`paddle_${action}`, async () => {
  if (action === "simulator") return simulate();
  if (action === "preflight" || action === "provision") return configure(action === "provision");
  throw new Error("unsupported_command");
});
