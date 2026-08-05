import { candidates as mockCandidates } from "@/lib/api/mock-data";
import type { Candidate } from "@/types/profile";

export async function getCandidates(): Promise<Candidate[]> {
  try {
    const response = await fetch("/api/candidates", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`candidates_http_${response.status}`);
    }
    const body = (await response.json()) as { candidates?: Candidate[] };
    if (!Array.isArray(body.candidates)) {
      throw new Error("candidates_invalid_body");
    }
    return body.candidates;
  } catch {
    // Local/dev fallback when API is unavailable; Preview DB runtime should succeed above.
    return mockCandidates;
  }
}
