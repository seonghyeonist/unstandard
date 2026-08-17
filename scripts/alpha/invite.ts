import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { and, eq, inArray } from "drizzle-orm";
import {
  isAlphaAcquisitionChannel,
  isAlphaBalanceBucket,
  isAlphaRecruitmentCohort,
} from "../../lib/alpha/stage1-policy";
import { createStage1Invite, Stage1InviteError } from "../../lib/alpha/invite-admin";
import { getDb } from "../../lib/db/client";
import { alphaInvites } from "../../lib/db/schema/invites";
import { normalizeEmail } from "../../lib/auth/invite-crypto";

type Command = "create" | "revoke" | "list";

function parseCommand(): Command {
  const arg = process.argv[2];
  if (arg === "create" || arg === "revoke" || arg === "list") return arg;
  throw new Error(
    "Usage: npm run alpha:invite:<create|revoke|list> -- --email user@example.com " +
      "--cohort <cohort> --channel <channel> --balance-bucket <bucket_a|bucket_b|not_counted>",
  );
}

function readEmailFlag(): string {
  const index = process.argv.indexOf("--email");
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error("--email is required");
  }
  return normalizeEmail(process.argv[index + 1]);
}

function readFlag(name: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`${name} is required`);
  return process.argv[index + 1].trim();
}

async function createInvite(email: string): Promise<void> {
  const recruitmentCohort = readFlag("--cohort");
  const acquisitionChannel = readFlag("--channel");
  const balanceBucket = readFlag("--balance-bucket");
  if (!isAlphaRecruitmentCohort(recruitmentCohort)) throw new Error("invalid --cohort");
  if (!isAlphaAcquisitionChannel(acquisitionChannel)) throw new Error("invalid --channel");
  if (!isAlphaBalanceBucket(balanceBucket)) throw new Error("invalid --balance-bucket");

  const created = await createStage1Invite({
    email,
    recruitmentCohort,
    acquisitionChannel,
    balanceBucket,
  });

  console.log("INVITE_CREATED");
  console.log(`email=${created.email}`);
  console.log(`code=${created.rawCode}`);
  console.log(`occupied_seats=${created.occupiedSeats}/50`);
  console.log(`balance_gate=${created.balanceGate.gate}`);
  console.log("Store this code securely — it will not be shown again.");
}

async function revokeInvite(email: string): Promise<void> {
  const db = getDb();
  const result = await db
    .update(alphaInvites)
    .set({ status: "revoked", reservedAt: null, reservationNonceHash: null })
    .where(
      and(
        eq(alphaInvites.emailNormalized, email),
        inArray(alphaInvites.status, ["pending", "reserved"]),
      ),
    )
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
      targetPhase: alphaInvites.targetPhase,
      recruitmentCohort: alphaInvites.recruitmentCohort,
      acquisitionChannel: alphaInvites.acquisitionChannel,
      balanceBucket: alphaInvites.balanceBucket,
    })
    .from(alphaInvites);

  for (const row of rows) {
    const email = row.emailNormalized.replace(/(^.).*(@.*$)/, "$1***$2");
    console.log(
      `id=${row.id.slice(0, 8)} email=${email} status=${row.status} ` +
        `phase=${row.targetPhase} ` +
        `cohort=${row.recruitmentCohort} channel=${row.acquisitionChannel} ` +
        `balance=${row.balanceBucket} expires=${row.expiresAt.toISOString()}`,
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
  const message = error instanceof Stage1InviteError ? error.code : error instanceof Error ? error.message : "invite command failed";
  console.error(message);
  process.exit(1);
});
