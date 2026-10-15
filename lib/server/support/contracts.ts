export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export type SupportStatus = typeof SUPPORT_STATUSES[number];
export type SupportUpdate = {
  expectedStatus: SupportStatus;
  expectedUpdatedAt: string;
  status: SupportStatus;
  assignedTo: "seonghyeonist";
  response: string | null;
};
export function parseSupportUpdate(value: unknown): SupportUpdate | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const statuses: readonly unknown[] = SUPPORT_STATUSES;
  if (!statuses.includes(input.expectedStatus) || !statuses.includes(input.status) || input.assignedTo !== "seonghyeonist") return null;
  if (typeof input.expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.expectedUpdatedAt) || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) return null;
  const response = typeof input.response === "string" ? input.response.trim() : null;
  if (input.response != null && (response === null || response.length < 10 || response.length > 2000)) return null;
  if (input.status === "CLOSED" && !response) return null;
  return { expectedStatus: input.expectedStatus as SupportStatus, expectedUpdatedAt: input.expectedUpdatedAt, status: input.status as SupportStatus, assignedTo: "seonghyeonist", response };
}
export interface SupportRepository {
  create(userId: string, category: string, message: string): Promise<string>;
  listForMember(userId: string): Promise<unknown[]>;
  listForOperator(): Promise<unknown[]>;
  update(ticketId: string, input: SupportUpdate): Promise<boolean>;
}
