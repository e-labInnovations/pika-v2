import type { Payload } from 'payload'
import { APIError } from 'payload'
import type { User } from '@/payload-types'
import type { ParsedSms } from './parse'
import type { SmsSuggestion } from './ingest'
import { processTextToSplit } from '../ai/service'
import { refreshTitleMonth, userTimeZone } from './mealTitle'

/**
 * One SMS payment that paid for several things (rent and electricity in one UPI
 * transfer) is confirmed as one transaction per part. Parts share the bank's date,
 * account and reference; their amounts add up to the bank amount exactly.
 */
export type SmsPart = {
  title: string
  amount: string
  category: string | null
  tags: string[]
  person: string | null
}

const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

const paise = (v: string | number) => Math.round(Number(v) * 100)
const rupees = (p: number) => (p / 100).toFixed(2)
const shown = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Throws a 400 unless there are 2+ parts, each above zero, adding up to `total`. */
export function checkPartsTotal(parts: SmsPart[], total: string): void {
  if (parts.length < 2) throw new APIError('A split needs at least two parts.', 400, { code: 'split_parts' })
  for (const p of parts) {
    const v = paise(p.amount)
    if (!Number.isFinite(v) || v <= 0) throw new APIError('Every part needs an amount above zero.', 400, { code: 'split_amount' })
  }
  const sum = parts.reduce((a, p) => a + paise(p.amount), 0)
  const want = paise(total)
  if (sum !== want) {
    throw new APIError(`The parts add up to ₹${shown(sum)}, not the bank's ₹${shown(want)}.`, 400, { code: 'split_total' })
  }
}

type PartLike = { title: unknown; amount: unknown; category: unknown; tags?: unknown; person?: unknown }

const toPart = (t: PartLike, amount: number): SmsPart => ({
  title: String(t.title ?? '').trim(),
  amount: rupees(amount),
  category: idOf(t.category),
  tags: Array.isArray(t.tags) ? (t.tags as unknown[]).map(idOf).filter((x): x is string => !!x) : [],
  person: idOf(t.person),
})

/**
 * A past two-part payment applied to a new total: the larger part keeps its amount
 * (the fixed rent), the other takes the rest (that month's electricity). Null when the
 * group is not two parts or the new total leaves nothing for the second part.
 */
export function splitFromGroup(group: PartLike[], total: string): SmsPart[] | null {
  if (group.length !== 2) return null
  const [large, small] = [...group].sort((a, b) => paise(String(b.amount)) - paise(String(a.amount)))
  const keep = paise(String(large.amount))
  const rest = paise(total) - keep
  if (!(keep > 0) || !(rest > 0)) return null
  return [toPart(large, keep), toPart(small, rest)]
}

const REF_IN_NOTE = /\bref(?:erence)?\s*(?:no\.?|number)?\s*[:.]?\s*(\d{9,})/i

/**
 * Parts for a new payment to a payee whose last split payment had two parts: from the
 * last SMS confirmed as a split for this merchant, else from past transactions that
 * mention the merchant and share one bank reference. Titles get the new month.
 */
export async function historySplit(
  payload: Payload,
  userId: string,
  p: ParsedSms,
  merchantKey: string | null,
  at: Date | null,
): Promise<SmsPart[] | null> {
  if (p.type !== 'expense') return null
  let group: PartLike[] | null = null

  if (merchantKey) {
    const learned = await payload.find({
      collection: 'captured-sms',
      where: {
        and: [
          { user: { equals: userId } },
          { merchantKey: { equals: merchantKey } },
          { status: { equals: 'confirmed' } },
          { parts: { exists: true } },
        ],
      },
      sort: '-receivedAt',
      limit: 1,
      depth: 1,
    })
    const parts = learned.docs[0]?.parts
    if (Array.isArray(parts) && parts.length && parts.every((t) => t && typeof t === 'object')) group = parts as PartLike[]
  }

  if (!group && p.merchant && p.merchant.length >= 4) {
    const noted = await payload.find({
      collection: 'transactions',
      where: { and: [{ user: { equals: userId } }, { type: { equals: 'expense' } }, { note: { contains: p.merchant } }] },
      sort: '-date',
      limit: 12,
      depth: 0,
    })
    const byRef = new Map<string, PartLike[]>()
    const order: string[] = []
    for (const t of noted.docs) {
      const ref = (t.externalRef as string | null) || REF_IN_NOTE.exec(String(t.note ?? ''))?.[1]
      if (!ref) continue
      if (!byRef.has(ref)) {
        byRef.set(ref, [])
        order.push(ref)
      }
      byRef.get(ref)!.push(t as unknown as PartLike)
    }
    const latestSplit = order.find((r) => byRef.get(r)!.length > 1)
    if (latestSplit) group = byRef.get(latestSplit)!
  }

  if (!group) return null
  const parts = splitFromGroup(group, p.amount)
  if (!parts) return null
  if (at) {
    const tz = await userTimeZone(payload, userId)
    for (const part of parts) part.title = refreshTitleMonth(part.title, at, tz)
  }
  return parts
}

/**
 * Asks the AI to split a pending SMS, guided by what the user typed ("7000 rent, rest
 * electricity"). The parts are saved as the suggestion, never confirmed. The bank total
 * is never changed: the last part gets whatever the others leave.
 */
export async function splitSmsWithAI(
  payload: Payload,
  user: User,
  id: string,
  text = '',
): Promise<{ parts: SmsPart[] }> {
  if (text.length > 1000) throw new APIError('Keep it under 1000 characters.', 400)
  const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0, user, overrideAccess: false })
  if (sms.status !== 'pending') throw new APIError(`This SMS is ${sms.status}, not pending.`, 409)
  const parsed = sms.parsed as ParsedSms | null
  if (!parsed) throw new APIError('This SMS could not be parsed.', 422)

  const bankSms = `Bank SMS: ${sms.body}`
  const input = text.trim() ? `${text.trim()}\n\n${bankSms}` : bankSms
  const res = await processTextToSplit(payload, String(user.id), input, parsed.amount)
  const raw = Array.isArray(res.data?.parts) ? (res.data.parts as PartLike[]) : []
  if (raw.length < 2) throw new APIError("The AI didn't find more than one part. Add the parts by hand.", 422)

  // Only real child categories of the right type survive; others are left to pick.
  const ids = [...new Set(raw.map((r) => idOf(r.category)).filter((x): x is string => !!x))]
  const okCats = ids.length
    ? new Set(
        (
          await payload.find({
            collection: 'categories',
            where: { and: [{ id: { in: ids } }, { type: { equals: parsed.type } }, { parent: { exists: true } }] },
            limit: ids.length,
            depth: 0,
            overrideAccess: true,
          })
        ).docs.map((c) => String(c.id)),
      )
    : new Set<string>()

  const total = paise(parsed.amount)
  const head = raw.slice(0, -1).map((r) => paise(String(r.amount)))
  const rest = total - head.reduce((a, b) => a + b, 0)
  if (head.some((v) => !Number.isFinite(v) || v <= 0) || !(rest > 0)) {
    throw new APIError("The AI's split doesn't fit the bank amount. Adjust the parts by hand.", 422)
  }
  const parts = raw.map((r, i) => {
    const part = toPart({ ...r, person: null }, i < head.length ? head[i] : rest)
    if (part.category && !okCats.has(part.category)) part.category = null
    if (!part.title) part.title = `Part ${i + 1}`
    return part
  })

  const s = (sms.suggestion ?? {}) as SmsSuggestion
  const saved = await payload.update({
    collection: 'captured-sms',
    where: { and: [{ id: { equals: id } }, { status: { equals: 'pending' } }] },
    data: { suggestion: { ...s, parts, partsFrom: 'ai' } } as any,
    user,
    overrideAccess: false,
  })
  if (!saved.docs.length) throw new APIError('This SMS was confirmed meanwhile.', 409)
  return { parts }
}
