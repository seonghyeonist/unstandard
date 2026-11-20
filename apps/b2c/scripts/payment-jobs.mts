import { stat, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { connectDatabase } from "../db/client.mts";
import { loadPaymentConfig } from "../server/payment-config.mts";
import { createPayments } from "../server/payments.mts";
import { runPaymentJobs } from "../server/payment-worker.mts";
import { allowWrites, required, summarize } from "./paddle-api.mts";

await summarize("sandbox_payment_jobs", async () => {
  allowWrites("reconcile-b2c-sandbox");
  const sink = required("B2C_LOCAL_MAIL_SINK");
  if (!isAbsolute(sink) || sink.startsWith(process.cwd() + "/")) throw new Error("private_mail_sink_required");
  const target = await stat(sink);
  if (!target.isDirectory() || (target.mode & 0o077) !== 0) throw new Error("private_mail_sink_required");
  const config = loadPaymentConfig();
  const { db, pool } = connectDatabase();
  try {
    return await runPaymentJobs(db, createPayments(db, config.provider, config.tokenKey, config.origin), async (message) => {
      try {
        await writeFile(join(sink, message.id + ".json"), JSON.stringify(message), { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
    });
  } finally {
    await pool.end();
  }
});
