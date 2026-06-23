/**
 * Local persistence for safety reports.
 *
 * Today this appends to `sessionStorage` (matching the mock auth/onboarding
 * layers). The record shape mirrors a future Supabase `reports` row so the
 * migration is a storage-adapter swap, not a rewrite. Keep all storage logic
 * here, isolated from UI and from moderation concepts.
 */

const STORAGE_KEY = "unstandard.alpha.reports";

export type ReportRecord = {
  id: string;
  reporterUserId: string;
  targetType: "profile" | "answer" | "message";
  targetId: string;
  reason: string;
  createdAt: string;
  status: "OPEN";
};

export function getReports(): ReportRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendReport(record: ReportRecord): ReportRecord[] {
  const reports = [...getReports(), record];
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }
  return reports;
}
