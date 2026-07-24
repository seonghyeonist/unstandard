import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { schema } from "@/lib/db/schema";

/** Shared Drizzle executor type for pool connections and transactions. */
export type DbExecutor = NeonDatabase<typeof schema>;
