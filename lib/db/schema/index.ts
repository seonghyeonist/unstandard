export * from "@/lib/db/schema/profile-basics";
import * as profileBasicsSchema from "@/lib/db/schema/profile-basics";
export * from "@/lib/db/schema/auth";
export * from "@/lib/db/schema/profiles";
export * from "@/lib/db/schema/questions";
export * from "@/lib/db/schema/answers";
export * from "@/lib/db/schema/reports";
export * from "@/lib/db/schema/blocks";
export * from "@/lib/db/schema/unlocks";
export * from "@/lib/db/schema/unlock-attempts";
export * from "@/lib/db/schema/invites";
export * from "@/lib/db/schema/app-config";
export * from "@/lib/db/schema/support";
export * from "@/lib/db/schema/messages";
export * from "@/lib/db/schema/alpha-activity";
export * from "@/lib/db/schema/alpha-exposures";
export * from "@/lib/db/schema/waitlist";
export * from "@/lib/db/schema/legal-acceptances";

import * as authSchema from "@/lib/db/schema/auth";
import * as profilesSchema from "@/lib/db/schema/profiles";
import * as questionsSchema from "@/lib/db/schema/questions";
import * as answersSchema from "@/lib/db/schema/answers";
import * as reportsSchema from "@/lib/db/schema/reports";
import * as blocksSchema from "@/lib/db/schema/blocks";
import * as unlocksSchema from "@/lib/db/schema/unlocks";
import * as unlockAttemptsSchema from "@/lib/db/schema/unlock-attempts";
import * as invitesSchema from "@/lib/db/schema/invites";
import * as appConfigSchema from "@/lib/db/schema/app-config";
import * as supportSchema from "@/lib/db/schema/support";
import * as messagesSchema from "@/lib/db/schema/messages";
import * as alphaActivitySchema from "@/lib/db/schema/alpha-activity";
import * as alphaExposuresSchema from "@/lib/db/schema/alpha-exposures";
import * as waitlistSchema from "@/lib/db/schema/waitlist";
import * as legalAcceptancesSchema from "@/lib/db/schema/legal-acceptances";

export const schema = {
  ...profileBasicsSchema,
  ...authSchema,
  ...profilesSchema,
  ...questionsSchema,
  ...answersSchema,
  ...reportsSchema,
  ...blocksSchema,
  ...unlocksSchema,
  ...unlockAttemptsSchema,
  ...invitesSchema,
  ...appConfigSchema,
  ...supportSchema,
  ...messagesSchema,
  ...alphaActivitySchema,
  ...alphaExposuresSchema,
  ...waitlistSchema,
  ...legalAcceptancesSchema,
};
