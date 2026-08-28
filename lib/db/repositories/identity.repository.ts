import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profileBasics, identityVerifications } from "@/lib/db/schema/profile-basics";
import { profiles } from "@/lib/db/schema/profiles";
import { INTRODUCTION_SCOPE_VERSION, PROFILE_CONSENT_VERSION, PROFILE_FRESHNESS_MS } from "@/lib/profile/basics";
import { IDENTITY_NOTICE_VERSION, IDENTITY_REQUEST_TTL_MS, type IdentityRepository, type IdentityRequest } from "@/lib/identity/contracts";

export const identityRepository: IdentityRepository = {
  async begin(userId, provider, now) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).for("update");
      const [b] = await tx.select().from(profileBasics).where(eq(profileBasics.userId, userId));
      if (!b?.introductionScopeAccepted || b.profileConsentVersion !== PROFILE_CONSENT_VERSION ||
        b.introductionScopeVersion !== INTRODUCTION_SCOPE_VERSION || b.updatedAt > now ||
        now.getTime() - b.updatedAt.getTime() >= PROFILE_FRESHNESS_MS) return null;
      await tx.delete(identityVerifications).where(and(eq(identityVerifications.status, "pending"), lt(identityVerifications.expiresAt, now)));
      const request: IdentityRequest = { userId, requestId: randomUUID(), profileRevision: b.revision,
        provider, requestedAt: now, expiresAt: new Date(now.getTime() + IDENTITY_REQUEST_TTL_MS), status: "pending" };
      await tx.insert(identityVerifications).values({ ...request, noticeVersion: IDENTITY_NOTICE_VERSION }).onConflictDoUpdate({ target: identityVerifications.userId, set: { ...request, noticeVersion: IDENTITY_NOTICE_VERSION, verifiedAt: null } });
      return request;
    });
  },
  async find(userId, requestId) {
    const [row] = await getDb().select().from(identityVerifications).where(and(
      eq(identityVerifications.userId, userId), eq(identityVerifications.requestId, requestId),
    ));
    return row ? { ...row, status: row.status as IdentityRequest["status"] } : null;
  },
  async complete(request, now) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, request.userId)).for("update");
      const [b] = await tx.select().from(profileBasics).where(eq(profileBasics.userId, request.userId));
      const [v] = await tx.select().from(identityVerifications).where(eq(identityVerifications.userId, request.userId));
      if (!b?.introductionScopeAccepted || b.revision !== request.profileRevision ||
        b.profileConsentVersion !== PROFILE_CONSENT_VERSION || b.introductionScopeVersion !== INTRODUCTION_SCOPE_VERSION ||
        now.getTime() - b.updatedAt.getTime() >= PROFILE_FRESHNESS_MS ||
        !v || v.noticeVersion !== IDENTITY_NOTICE_VERSION || v.requestId !== request.requestId || v.profileRevision !== b.revision || v.provider !== request.provider ||
        v.expiresAt <= now || v.requestedAt > now) return false;
      if (v.status === "verified") return true;
      await tx.update(identityVerifications).set({ status: "verified", verifiedAt: now }).where(eq(identityVerifications.userId, request.userId));
      return true;
    });
  },
};
