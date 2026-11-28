import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client.mts";
import { jobs, paymentRateLimits } from "../db/schema.mts";
import type { MailSink, Payments } from "./payments.mts";

const minute = 60_000;

// The attempt number fences late workers after re-lease. External sinks also dedupe by message ID.
export async function runPaymentJobs(db: Database, payment: Payments, send: MailSink, maxJobs = 25) {
  const summary = { finished: 0, retryable: 0, exhausted: 0 };
  const now = payment.clock();
  const stamp = now.toISOString();
  await db.delete(paymentRateLimits).where(sql`${paymentRateLimits.expiresAt} < ${stamp}::timestamptz`);
  await db.execute(sql`
    insert into b2c.jobs (order_id, kind)
    select id, 'reconcile_payment' from b2c.orders
    where payment_mode = ${payment.provider.mode} and state = 'pending'
      and checkout_attempt_at is not null and created_at <= ${new Date(+now - 5 * minute).toISOString()}::timestamptz
    on conflict (order_id, kind, revision) do nothing
  `);
  await db.execute(sql`
    update b2c.orders o set payment_review = 'refund_review_undelivered'
    where o.payment_mode = ${payment.provider.mode} and o.state = 'paid' and o.payment_review is null
      and o.paid_at <= ${new Date(+now - 24 * 60 * minute).toISOString()}::timestamptz
      and not exists (select 1 from b2c.rooms r
        join b2c.members m on m.room_id = r.id and m.role = 'buyer'
        join b2c.cards c on c.room_id = r.id and c.owner_member_id = m.id and c.kind = 'personal'
        where r.order_id = o.id)
  `);
  await db.execute(sql`
    update b2c.orders set payment_review = 'refund_review_unconfirmed'
    where payment_mode = ${payment.provider.mode} and state = 'pending' and payment_review is null
      and checkout_attempt_at <= ${new Date(+now - 24 * 60 * minute).toISOString()}::timestamptz
  `);
  for (let index = 0; index < maxJobs; index++) {
    const startedAt = payment.clock();
    const leaseUntil = new Date(+startedAt + 2 * minute);
    const [job] = await db.transaction(async (tx) => {
      const [next] = (await tx.execute<{id: string}>(sql`
        select j.id from b2c.jobs j join b2c.orders o on o.id = j.order_id
        where o.payment_mode = ${payment.provider.mode}
          and j.kind in ('reconcile_payment', 'index_payment_email', 'recovery_mail')
          and j.finished_at is null and j.attempts < 3
          and (j.lease_until is null or j.lease_until <= ${startedAt.toISOString()}::timestamptz)
        order by j.id limit 1 for update of j skip locked
      `)).rows;
      if (!next) return [];
      return tx.update(jobs).set({ attempts: sql`${jobs.attempts} + 1`, leaseUntil })
        .where(eq(jobs.id, next.id)).returning();
    });
    if (!job) break;
    const fence = and(eq(jobs.id, job.id), eq(jobs.attempts, job.attempts), isNull(jobs.finishedAt));
    try {
      if (job.kind === "reconcile_payment") await payment.reconcile(job.orderId);
      else if (job.kind === "index_payment_email") await payment.indexEmail(job.orderId);
      else if (typeof job.payload?.id === "string") await payment.sendRecovery(job.orderId, job.payload.id, send);
      await db.update(jobs).set({ finishedAt: payment.clock(), leaseUntil: null, payload: null }).where(fence);
      summary.finished++;
    } catch {
      const retryAt = new Date(+payment.clock() + (job.kind === "reconcile_payment" ? 5 : 1) * minute);
      await db.update(jobs).set({ leaseUntil: retryAt }).where(fence);
      if (job.attempts === 3) summary.exhausted++;
      else summary.retryable++;
    }
  }
  return summary;
}
