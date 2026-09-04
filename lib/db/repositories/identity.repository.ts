import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profileBasics, identityVerifications } from "@/lib/db/schema/profile-basics";
import { profiles } from "@/lib/db/schema/profiles";
import { INTRODUCTION_SCOPE_VERSION, PROFILE_CONSENT_VERSION, PROFILE_FRESHNESS_MS } from "@/lib/profile/basics";
import {
  IDENTITY_BIOMETRIC_CONSENT_VERSION,
  IDENTITY_NOTICE_VERSION,
  IDENTITY_REQUEST_TTL_MS,
  type IdentityProof,
  type IdentityRepository,
  type IdentityRequest,
} from "@/lib/identity/contracts";

function toIdentityRequest(row: typeof identityVerifications.$inferSelect): IdentityRequest {
  return {
    userId: row.userId,
    requestId: row.requestId,
    profileRevision: row.profileRevision,
    status: row.status as IdentityRequest["status"],
    provider: row.provider,
    providerReference: row.providerReference,
    biometricConsentVersion: row.biometricConsentVersion,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    verifiedAt: row.verifiedAt,
    providerPurgedAt: row.providerPurgedAt,
  };
}

function profileIsFreshAndConsented(
  basics: typeof profileBasics.$inferSelect | undefined,
  now: Date,
): boolean {
  return Boolean(
    basics?.introductionScopeAccepted &&
      basics.profileConsentVersion === PROFILE_CONSENT_VERSION &&
      basics.introductionScopeVersion === INTRODUCTION_SCOPE_VERSION &&
      basics.updatedAt <= now &&
      now.getTime() - basics.updatedAt.getTime() < PROFILE_FRESHNESS_MS,
  );
}

export const identityRepository: IdentityRepository = {
  async begin(userId, provider, biometricConsentVersion, now) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).for("update");
      const [basics] = await tx.select().from(profileBasics).where(eq(profileBasics.userId, userId));
      if (!profileIsFreshAndConsented(basics, now)) return null;
      if (!basics) return null;

      const [current] = await tx
        .select()
        .from(identityVerifications)
        .where(eq(identityVerifications.userId, userId));
      if (current && current.status !== "pending") return null;
      if (
        current &&
        current.provider === provider &&
        current.profileRevision === basics.revision &&
        current.biometricConsentVersion === biometricConsentVersion &&
        current.expiresAt > now
      ) {
        return toIdentityRequest(current);
      }

      // Keep a pending row with a provider reference until the service has
      // proved that its hosted session was deleted. A row without a provider
      // session has nothing external to clean up, so stale profile bindings
      // can be replaced inside this transaction.
      if (current?.providerReference) return toIdentityRequest(current);
      if (current) {
        await tx.delete(identityVerifications).where(
          and(
            eq(identityVerifications.userId, userId),
            eq(identityVerifications.requestId, current.requestId),
            eq(identityVerifications.status, "pending"),
          ),
        );
      }

      const request: IdentityRequest = {
        userId,
        requestId: randomUUID(),
        profileRevision: basics.revision,
        status: "pending",
        provider,
        providerReference: null,
        biometricConsentVersion,
        requestedAt: now,
        expiresAt: new Date(now.getTime() + IDENTITY_REQUEST_TTL_MS),
        verifiedAt: null,
        providerPurgedAt: null,
      };
      await tx
        .insert(identityVerifications)
        .values({
          ...request,
          noticeVersion: IDENTITY_NOTICE_VERSION,
        })
        .onConflictDoUpdate({
          target: identityVerifications.userId,
          set: {
            ...request,
            noticeVersion: IDENTITY_NOTICE_VERSION,
          },
        });
      return request;
    });
  },

  async removePending(request) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, request.userId)).for("update");
      const deleted = await tx.delete(identityVerifications).where(
        and(
          eq(identityVerifications.userId, request.userId),
          eq(identityVerifications.requestId, request.requestId),
          eq(identityVerifications.status, "pending"),
        ),
      ).returning({ userId: identityVerifications.userId });
      return deleted.length === 1;
    });
  },

  async findCurrent(userId) {
    const [row] = await getDb()
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.userId, userId));
    return row ? toIdentityRequest(row) : null;
  },

  async find(userId, requestId) {
    const [row] = await getDb()
      .select()
      .from(identityVerifications)
      .where(and(eq(identityVerifications.userId, userId), eq(identityVerifications.requestId, requestId)));
    return row ? toIdentityRequest(row) : null;
  },

  async findByProviderReference(providerReference) {
    const [row] = await getDb()
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.providerReference, providerReference));
    return row ? toIdentityRequest(row) : null;
  },

  async bindProviderReference(request, providerReference) {
    const updated = await getDb()
      .update(identityVerifications)
      .set({ providerReference })
      .where(
        and(
          eq(identityVerifications.userId, request.userId),
          eq(identityVerifications.requestId, request.requestId),
          eq(identityVerifications.provider, request.provider),
          eq(identityVerifications.status, "pending"),
        ),
      )
      .returning({ userId: identityVerifications.userId });
    return updated.length === 1;
  },

  async markVerifiedUnpurged(request, proof: IdentityProof, now) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, request.userId)).for("update");
      const [basics] = await tx.select().from(profileBasics).where(eq(profileBasics.userId, request.userId));
      const [verification] = await tx
        .select()
        .from(identityVerifications)
        .where(eq(identityVerifications.userId, request.userId));
      if (
        !profileIsFreshAndConsented(basics, now) ||
        !verification ||
        verification.status !== "pending" ||
        verification.requestId !== request.requestId ||
        !basics ||
        verification.profileRevision !== basics.revision ||
        verification.provider !== request.provider ||
        verification.providerReference !== request.providerReference ||
        verification.noticeVersion !== IDENTITY_NOTICE_VERSION ||
        verification.biometricConsentVersion !== IDENTITY_BIOMETRIC_CONSENT_VERSION ||
        verification.expiresAt <= now ||
        verification.requestedAt > now ||
        !Number.isFinite(proof.verifiedAt.getTime()) ||
        proof.verifiedAt < verification.requestedAt ||
        proof.verifiedAt > now ||
        now.getTime() - proof.verifiedAt.getTime() >= IDENTITY_REQUEST_TTL_MS ||
        proof.requestId !== request.requestId ||
        proof.providerReference !== request.providerReference ||
        proof.documentVerified !== true ||
        proof.livenessVerified !== true ||
        proof.faceMatchVerified !== true ||
        proof.deviceIpVerified !== true ||
        proof.adultVerified !== true
      ) {
        return false;
      }
      const updated = await tx
        .update(identityVerifications)
        .set({ status: "verified_unpurged", verifiedAt: proof.verifiedAt, providerPurgedAt: null })
        .where(
          and(
            eq(identityVerifications.userId, request.userId),
            eq(identityVerifications.requestId, request.requestId),
            eq(identityVerifications.status, "pending"),
          ),
        )
        .returning({ userId: identityVerifications.userId });
      return updated.length === 1;
    });
  },

  async markVerified(request, purgedAt) {
    return getDb().transaction(async (tx) => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, request.userId)).for("update");
      const [verification] = await tx
        .select()
        .from(identityVerifications)
        .where(eq(identityVerifications.userId, request.userId));
      const [basics] = await tx
        .select()
        .from(profileBasics)
        .where(eq(profileBasics.userId, request.userId));
      if (
        !verification ||
        !profileIsFreshAndConsented(basics, purgedAt) ||
        !basics ||
        verification.profileRevision !== basics.revision ||
        verification.requestId !== request.requestId ||
        verification.provider !== request.provider ||
        verification.providerReference !== request.providerReference ||
        verification.noticeVersion !== IDENTITY_NOTICE_VERSION ||
        verification.biometricConsentVersion !== IDENTITY_BIOMETRIC_CONSENT_VERSION
      ) {
        return false;
      }
      if (verification.status === "verified") return verification.providerPurgedAt !== null;
      if (
        verification.status !== "verified_unpurged" ||
        !verification.verifiedAt ||
        !Number.isFinite(purgedAt.getTime()) ||
        purgedAt < verification.verifiedAt
      ) {
        return false;
      }
      const updated = await tx
        .update(identityVerifications)
        .set({ status: "verified", providerPurgedAt: purgedAt })
        .where(
          and(
            eq(identityVerifications.userId, request.userId),
            eq(identityVerifications.requestId, request.requestId),
            eq(identityVerifications.status, "verified_unpurged"),
          ),
        )
        .returning({ userId: identityVerifications.userId });
      return updated.length === 1;
    });
  },
};
