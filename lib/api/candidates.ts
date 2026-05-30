import { candidates } from "@/lib/api/mock-data";
import type { Candidate } from "@/types/profile";

export async function getCandidates(): Promise<Candidate[]> {
  return candidates;
}
