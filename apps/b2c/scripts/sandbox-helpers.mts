export class Blocked extends Error {}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Blocked(`missing_${name}`);
  return value;
}
export function allowWrites(action: string) {
  if (required("B2C_SANDBOX_WRITE_CONFIRM") !== action) throw new Blocked("sandbox_write_confirmation_required");
}
export async function summarize(layer: string, run: () => Promise<Record<string, unknown>>) {
  try {
    const data = await run();
    console.log(JSON.stringify({ layer, status: "PASS", ...data }));
  } catch (error) {
    const status = error instanceof Blocked ? "BLOCKED" : "FAIL";
    // Only stable codes may reach evidence. Browser/DB/SDK errors can contain private request data.
    const reason = error instanceof Error && /^(?:[a-z_0-9]{3,100}|missing_[A-Z_0-9]{3,100})$/.test(error.message)
      ? error.message : "operation_failed";
    console.log(JSON.stringify({ layer, status, reason }));
    process.exitCode = status === "BLOCKED" ? 78 : 1;
  }
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
