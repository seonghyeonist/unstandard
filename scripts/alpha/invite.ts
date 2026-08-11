import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { eq } from "drizzle-orm";
import { getDb } from "../../lib/db/client";
import { alphaInvites } from "../../lib/db/schema/invites";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeEmail,
  requireInvitePepper,
} from "../../lib/auth/invite-crypto";

type Command = "create" | "revoke" | "list";

function parseCommand(): Command {
  const arg = process.argv[2];
  if (arg === "create" || arg === "revoke" || arg === "list") return arg;
  throw new Error("Usage: npm run alpha:invite:<create|revoke|list> -- --email user@example.com");
}

function readEmailFlag(): string {
  const index = process.argv.indexOf("--email");
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error("--email is required");
  }
  return normalizeEmail(process.argv[index + 1]);
}

async function createInvite(email: string): Promise<void> {
  const pepper = requireInvitePepper();
  const rawCode = generateInviteCode();
  const codeHash = hashInviteCode(rawCode, pepper);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = getDb();

  await db.insert(alphaInvites).values({
    emailNormalized: email,
    codeHash,
    status: "pending",
    expiresAt,
  });

  console.log("INVITE_CREATED");
  console.log(`email=${email}`);
  console.log(`code=${rawCode}`);
  console.log("Store this code securely — it will not be shown again.");
}

async function revokeInvite(email: string): Promise<void> {
  const db = getDb();
  const result = await db
    .update(alphaInvites)
    .set({ status: "revoked" })
    .where(eq(alphaInvites.emailNormalized, email))
    .returning({ id: alphaInvites.id });

  console.log(`revoked=${result.length}`);
}

async function listInvites(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      id: alphaInvites.id,
      emailNormalized: alphaInvites.emailNormalized,
      status: alphaInvites.status,
      expiresAt: alphaInvites.expiresAt,
      consumedAt: alphaInvites.consumedAt,
    })
    .from(alphaInvites);

  for (const row of rows) {
    const email = row.emailNormalized.replace(/(^.).*(@.*$)/, "$1***$2");
    console.log(
      `id=${row.id.slice(0, 8)} email=${email} status=${row.status} expires=${row.expiresAt.toISOString()}`,
    );
  }
}

async function main(): Promise<void> {
  const command = parseCommand();
  if (command === "list") {
    await listInvites();
    return;
  }

  const email = readEmailFlag();
  if (command === "create") {
    await createInvite(email);
    return;
  }

  await revokeInvite(email);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "invite command failed");
  process.exit(1);
});
