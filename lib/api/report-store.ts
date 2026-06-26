/**
 * Legacy client-side report helpers (sessionStorage).
 *
 * `ReportRecord` is the shared row shape — server persistence uses
 * `ReportsRepository` (alpha adapter), not this module.
 * sessionStorage helpers are dead code for the current UI path.
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
