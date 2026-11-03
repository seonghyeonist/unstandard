import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { Attribution, FunnelEvent } from "./policy";
import type { AppDatabase } from "@/lib/db/client";
// A deliberately aggregate-only repository: no visitor, session or member key.
export async function incrementFunnel(event: FunnelEvent, attribution: Attribution, executor: Pick<AppDatabase, "execute"> = getDb()) {
  await executor.execute(sql`
    INSERT INTO acquisition_daily (day, event, channel, campaign, content, count)
    VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date, ${event}, ${attribution.channel}, ${attribution.campaign}, ${attribution.content}, 1)
    ON CONFLICT (day, event, channel, campaign, content)
    DO UPDATE SET count = acquisition_daily.count + 1
  `);
}
