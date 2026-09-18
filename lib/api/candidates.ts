import type { Candidate } from "@/types/profile";

export async function getCandidates(): Promise<Candidate[]> {
  const response = await fetch("/api/candidates", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`candidates_http_${response.status}`);
  const body = (await response.json()) as { candidates?: Candidate[] };
  if (!Array.isArray(body.candidates)) throw new Error("candidates_invalid_body");
  return body.candidates;
}
