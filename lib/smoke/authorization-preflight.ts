import { isCanonicalUuid } from "@/lib/server/unlock/uuid";

type Candidate = { id?: unknown };

export function validateSmokeProfileIds(profileAId: string, profileBId: string): string[] {
  const failures: string[] = [];
  if (!isCanonicalUuid(profileAId)) {
    failures.push("SMOKE_USER_A_PROFILE_ID must be a canonical UUID");
  }
  if (!isCanonicalUuid(profileBId)) {
    failures.push("SMOKE_USER_B_PROFILE_ID must be a canonical UUID");
  }
  if (profileAId === profileBId) {
    failures.push("A and B profile UUIDs must be distinct");
  }
  return failures;
}

function candidateIds(body: unknown): Set<string> | null {
  if (!body || typeof body !== "object") return null;
  const source = (body as { source?: unknown }).source;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (source !== "database" || !Array.isArray(candidates)) return null;

  const ids = new Set<string>();
  for (const candidate of candidates as Candidate[]) {
    if (typeof candidate?.id !== "string" || !isCanonicalUuid(candidate.id)) {
      return null;
    }
    ids.add(candidate.id);
  }
  return ids;
}

export function credentialsOwnExpectedProfiles(input: {
  profileAId: string;
  profileBId: string;
  candidatesForA: unknown;
  candidatesForB: unknown;
}): boolean {
  const idsForA = candidateIds(input.candidatesForA);
  const idsForB = candidateIds(input.candidatesForB);
  if (!idsForA || !idsForB) return false;

  return (
    !idsForA.has(input.profileAId) &&
    idsForA.has(input.profileBId) &&
    !idsForB.has(input.profileBId) &&
    idsForB.has(input.profileAId)
  );
}
