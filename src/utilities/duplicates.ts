import type { Payload } from 'payload'
import { cosine, embed } from './ai/embeddings'

/** How far apart the same payment can be recorded (a manual entry's time is often when it was typed). */
const WINDOW_MS = 2 * 60 * 60_000
/** This close in time, the same amount is taken as the same payment whatever the titles. */
const SAME_MOMENT_MS = 20 * 60_000
/** Titles this similar describe the same thing ("Tea" / "Tea - Muthukumar"). */
const SIMILAR_TITLE = 0.6

export type DuplicateCandidate = {
  kind: 'transaction' | 'sms'
  /** Transaction id, or captured-sms id for a bank SMS still waiting for review. */
  id: string
  title: string
  amount: string
  date: string
}

export type DuplicateQuery = {
  type: string
  amount: string | number
  date: string
  title?: string | null
  /** The transaction being edited, or the SMS being reviewed (and its own transaction). */
  exclude?: string[]
  /** The new entry comes from a bank SMS (its title is a payee, not what was bought). */
  fromSms?: boolean
}

const num = (v: unknown) => parseFloat(String(v ?? '')) || 0

/**
 * Transactions (and pending bank SMS) that look like the same payment: same type and
 * amount within two hours, and either recorded within 20 minutes of each other, with
 * similar titles, or exactly one of the two from a bank SMS — a manual entry and an
 * SMS for the same amount that close together are almost always one payment. On
 * production history, same-amount pairs within two hours were rare (23 in two years)
 * while daily habits (₹45 breakfast) sit a day apart, so this stays quiet.
 */
export async function findPossibleDuplicates(
  payload: Payload,
  userId: string,
  q: DuplicateQuery,
): Promise<DuplicateCandidate[]> {
  const at = new Date(q.date).getTime()
  const amount = num(q.amount)
  if (!Number.isFinite(at) || amount <= 0) return []
  const range = { greater_than_equal: new Date(at - WINDOW_MS).toISOString(), less_than_equal: new Date(at + WINDOW_MS).toISOString() }
  const exclude = new Set(q.exclude ?? [])

  const [txs, sms] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { and: [{ user: { equals: userId } }, { type: { equals: q.type } }, { date: range }] },
      limit: 50,
      depth: 0,
      select: { title: true, amount: true, date: true, source: true },
    }),
    q.fromSms
      ? null
      : payload.find({
          collection: 'captured-sms',
          where: { and: [{ user: { equals: userId } }, { status: { equals: 'pending' } }, { receivedAt: range }] },
          limit: 50,
          depth: 0,
          select: { parsed: true, suggestion: true, receivedAt: true },
        }),
  ])

  type Row = DuplicateCandidate & { fromSms: boolean }
  const rows: Row[] = []
  for (const t of txs.docs) {
    if (exclude.has(String(t.id)) || Math.abs(num(t.amount) - amount) >= 0.005) continue
    rows.push({ kind: 'transaction', id: String(t.id), title: t.title ?? '', amount: String(t.amount), date: String(t.date), fromSms: t.source === 'sms' })
  }
  for (const s of sms?.docs ?? []) {
    const parsed = (s.parsed ?? {}) as { type?: string; amount?: string; occurredAt?: string | null }
    if (exclude.has(String(s.id)) || parsed.type !== q.type || Math.abs(num(parsed.amount) - amount) >= 0.005) continue
    const title = ((s.suggestion ?? {}) as { title?: string }).title ?? ''
    rows.push({ kind: 'sms', id: String(s.id), title, amount: String(parsed.amount), date: parsed.occurredAt ?? String(s.receivedAt), fromSms: true })
  }
  if (!rows.length) return []

  const titleVec = q.title?.trim() ? await embed(q.title.trim()).catch(() => null) : null
  const likely: (Row & { gap: number })[] = []
  for (const r of rows) {
    const gap = Math.abs(new Date(r.date).getTime() - at)
    let same = gap <= SAME_MOMENT_MS || r.fromSms !== Boolean(q.fromSms)
    if (!same && titleVec && r.title.trim()) {
      const vec = await embed(r.title.trim()).catch(() => null)
      same = !!vec && cosine(titleVec, vec) >= SIMILAR_TITLE
    }
    if (same) likely.push({ ...r, gap })
  }
  return likely
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3)
    .map(({ kind, id, title, amount, date }) => ({ kind, id, title, amount, date }))
}
