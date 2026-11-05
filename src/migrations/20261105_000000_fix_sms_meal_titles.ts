import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { fixMealWord, userTimeZone } from '../utilities/sms/mealTitle'

/**
 * Pending SMS suggestions saved before titles were matched to the time of day carry the
 * meal word of an older transaction ("Dinner - Zomato order" at noon). Rewrite them.
 * Returns how many were changed; a second run changes nothing.
 */
export async function fixPendingMealTitles(payload: Payload, req?: PayloadRequest): Promise<number> {
  const pending = await payload.find({
    collection: 'captured-sms',
    where: { status: { equals: 'pending' } },
    pagination: false,
    depth: 0,
    select: { user: true, suggestion: true, parsed: true, receivedAt: true },
    req,
  })
  const zones = new Map<string, string>()
  let changed = 0
  for (const doc of pending.docs) {
    const suggestion = doc.suggestion as { title?: string } | null
    if (!suggestion?.title) continue
    const userId = String(typeof doc.user === 'object' ? doc.user?.id : doc.user)
    if (!zones.has(userId)) zones.set(userId, await userTimeZone(payload, userId, req))
    const at = new Date((doc.parsed as { occurredAt?: string } | null)?.occurredAt ?? (doc.receivedAt as string))
    const title = fixMealWord(suggestion.title, at, zones.get(userId)!)
    if (title === suggestion.title) continue
    await payload.update({ collection: 'captured-sms', id: doc.id, data: { suggestion: { ...suggestion, title } } as any, req })
    changed++
  }
  return changed
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const n = await fixPendingMealTitles(payload, req)
  payload.logger.info(`fix_sms_meal_titles: corrected ${n} pending SMS title(s)`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Data fix only; the old (wrong) titles are not restored.
}
