import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { refreshTitleMonth, userTimeZone } from '../utilities/sms/mealTitle'
import { historySplit } from '../utilities/sms/split'
import type { ParsedSms } from '../utilities/sms/parse'

const merchantKeyOf = (doc: { merchantKey?: unknown }) => (typeof doc.merchantKey === 'string' ? doc.merchantKey : null)

/**
 * Pending SMS suggested before splits existed: give the month in a reused title the
 * payment's month, and suggest a split when the payee's last payment was split.
 * Returns how many changed; a second run changes nothing.
 */
export async function resuggestPendingSplits(payload: Payload, req?: PayloadRequest): Promise<number> {
  const pending = await payload.find({
    collection: 'captured-sms',
    where: { status: { equals: 'pending' } },
    pagination: false,
    depth: 0,
    req,
  })
  const zones = new Map<string, string>()
  let changed = 0
  for (const doc of pending.docs) {
    const s = doc.suggestion as { title?: string; parts?: unknown[] } | null
    const parsed = doc.parsed as ParsedSms | null
    if (!s || !parsed) continue
    const userId = String(typeof doc.user === 'object' ? doc.user?.id : doc.user)
    if (!zones.has(userId)) zones.set(userId, await userTimeZone(payload, userId, req))
    const at = new Date(parsed.occurredAt ?? (doc.receivedAt as string))
    const title = s.title ? refreshTitleMonth(s.title, at, zones.get(userId)!) : s.title
    const parts = s.parts?.length ? null : await historySplit(payload, userId, parsed, merchantKeyOf(doc), at, req).catch(() => null)
    if (title === s.title && !parts) continue
    await payload.update({
      collection: 'captured-sms',
      id: doc.id,
      data: { suggestion: { ...s, title, ...(parts ? { parts, partsFrom: 'history' } : {}) } } as any,
      req,
    })
    changed++
  }
  return changed
}

// captured_sms.parts (hasMany → transactions): the transactions a split SMS was confirmed
// into. Payload keeps hasMany relationships in a <collection>_rels table. Idempotent.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "captured_sms_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" uuid NOT NULL,
      "path" varchar NOT NULL,
      "transactions_id" uuid
    );
    CREATE INDEX IF NOT EXISTS "captured_sms_rels_order_idx" ON "captured_sms_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "captured_sms_rels_parent_idx" ON "captured_sms_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "captured_sms_rels_path_idx" ON "captured_sms_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "captured_sms_rels_transactions_id_idx" ON "captured_sms_rels" USING btree ("transactions_id");
  `)
  for (const [name, ddl] of [
    ['captured_sms_rels_parent_fk', sql`ALTER TABLE "captured_sms_rels" ADD CONSTRAINT "captured_sms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."captured_sms"("id") ON DELETE cascade ON UPDATE no action`],
    ['captured_sms_rels_transactions_fk', sql`ALTER TABLE "captured_sms_rels" ADD CONSTRAINT "captured_sms_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action`],
  ] as const) {
    const exists = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`)
    if (exists.rows.length === 0) await db.execute(ddl)
  }
  const n = await resuggestPendingSplits(payload, req)
  payload.logger.info(`add_sms_split_parts: updated ${n} pending SMS suggestion(s)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "captured_sms_rels" CASCADE;`)
}
