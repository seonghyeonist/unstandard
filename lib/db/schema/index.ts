export * from "@/lib/db/schema/auth";
export * from "@/lib/db/schema/profiles";
export * from "@/lib/db/schema/questions";
export * from "@/lib/db/schema/answers";
export * from "@/lib/db/schema/reports";
export * from "@/lib/db/schema/blocks";
export * from "@/lib/db/schema/unlocks";
export * from "@/lib/db/schema/invites";
export * from "@/lib/db/schema/app-config";

import * as authSchema from "@/lib/db/schema/auth";
import * as profilesSchema from "@/lib/db/schema/profiles";
import * as questionsSchema from "@/lib/db/schema/questions";
import * as answersSchema from "@/lib/db/schema/answers";
import * as reportsSchema from "@/lib/db/schema/reports";
import * as blocksSchema from "@/lib/db/schema/blocks";
import * as unlocksSchema from "@/lib/db/schema/unlocks";
import * as invitesSchema from "@/lib/db/schema/invites";
import * as appConfigSchema from "@/lib/db/schema/app-config";

export const schema = {
  ...authSchema,
  ...profilesSchema,
  ...questionsSchema,
  ...answersSchema,
  ...reportsSchema,
  ...blocksSchema,
  ...unlocksSchema,
  ...invitesSchema,
  ...appConfigSchema,
};
