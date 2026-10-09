import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { supportEvents, supportRequests } from "@/lib/db/schema/support";
import type { SupportRepository, SupportUpdate } from "@/lib/server/support/contracts";

export const supportRepository: SupportRepository = {
  async create(userId, category, message) {
    return getDb().transaction(async tx => {
      const [ticket] = await tx.insert(supportRequests).values({ userId, category, message, assignedTo: "seonghyeonist" }).returning({ id: supportRequests.id });
      if (!ticket) throw new Error("SUPPORT_UNAVAILABLE");
      await tx.insert(supportEvents).values({ ticketId: ticket.id, actor: "member", status: "OPEN", assignedTo: "seonghyeonist" });
      return ticket.id;
    });
  },
  async listForMember(userId) {
    const tickets = await getDb().select({ id: supportRequests.id, category: supportRequests.category, message: supportRequests.message, status: supportRequests.status, createdAt: supportRequests.createdAt, updatedAt: supportRequests.updatedAt }).from(supportRequests).where(eq(supportRequests.userId, userId)).orderBy(desc(supportRequests.createdAt)).limit(50);
    if (!tickets.length) return [];
    // Constrain replies through the owner's ticket inventory; never trust a caller's ticket id.
    const replies = await getDb().select({ ticketId: supportEvents.ticketId, response: supportEvents.response, createdAt: supportEvents.createdAt }).from(supportEvents).where(inArray(supportEvents.ticketId, tickets.map(t => t.id))).orderBy(supportEvents.createdAt);
    return tickets.map(t => ({ ...t, replies: replies.filter(r => r.ticketId === t.id && r.response !== null).map(({ response, createdAt }) => ({ response, createdAt })) }));
  },
  async listForOperator() {
    const tickets = await getDb().select({ id: supportRequests.id, category: supportRequests.category, message: supportRequests.message, status: supportRequests.status, assignedTo: supportRequests.assignedTo, createdAt: supportRequests.createdAt, updatedAt: supportRequests.updatedAt }).from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(50);
    if (!tickets.length) return [];
    const events = await getDb().select().from(supportEvents).where(inArray(supportEvents.ticketId, tickets.map(t => t.id))).orderBy(supportEvents.createdAt);
    const now = Date.now();
    return tickets.map(ticket => {
      const history = events.filter(e => e.ticketId === ticket.id);
      const firstResponseAt = history.find(e => e.response !== null)?.createdAt ?? null;
      return { ...ticket, history, firstResponseAt, slaBreached: (firstResponseAt?.getTime() ?? now) - ticket.createdAt.getTime() > 240 * 60_000 };
    });
  },
  async update(ticketId: string, input: SupportUpdate) {
    return getDb().transaction(async tx => {
      const [ticket] = await tx.update(supportRequests).set({ status: input.status, assignedTo: input.assignedTo, updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', ${supportRequests.updatedAt}) + interval '1 millisecond')` }).where(and(eq(supportRequests.id, ticketId), eq(supportRequests.status, input.expectedStatus), sql`date_trunc('milliseconds', ${supportRequests.updatedAt}) = ${input.expectedUpdatedAt}::timestamptz`)).returning({ id: supportRequests.id });
      if (!ticket) return false;
      await tx.insert(supportEvents).values({ ticketId, actor: "invite_operator", status: input.status, assignedTo: input.assignedTo, response: input.response });
      return true;
    });
  },
};
