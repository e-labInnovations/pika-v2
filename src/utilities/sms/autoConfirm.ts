import type { Payload } from 'payload'
import type { ParsedSms } from './parse'
import type { SmsSuggestion } from './ingest'

/** Confirms in a row, all the same way, before a merchant is trusted. */
export const TRUST_STREAK = 3

export type AutoConfirmSettings = { enabled: boolean; maxAmount: number }

const idOf = (v: unknown): string | null =>
  v == null ? null : String(typeof v === 'object' ? (v as { id: string }).id : v)
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

export async function loadAutoConfirmSettings(payload: Payload, userId: string): Promise<AutoConfirmSettings> {
  const res = await payload.find({
    collection: 'user-settings',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    context: { internal: true },
    select: { smsAutoConfirm: true, smsAutoConfirmMaxAmount: true },
  })
  const s = res.docs[0]
  return { enabled: !!s?.smsAutoConfirm, maxAmount: Number(s?.smsAutoConfirmMaxAmount ?? 2000) }
}

/** Kinds of SMS that may be confirmed without review, given the user's settings. */
export function eligible(settings: AutoConfirmSettings, p: ParsedSms, s: SmsSuggestion, account: string | null): boolean {
  return (
    settings.enabled &&
    s.from === 'sms' &&
    !!s.category &&
    !!account &&
    p.type !== 'transfer' &&
    s.type !== 'transfer' &&
    p.kind !== 'reversal' &&
    parseFloat(p.amount) <= settings.maxAmount
  )
}

/**
 * A merchant is trusted when its last TRUST_STREAK SMS were all confirmed into the same
 * title, category, tags and person this suggestion has. An undone auto-confirm among
 * them breaks the streak.
 */
export async function isTrusted(payload: Payload, userId: string, merchantKey: string, s: SmsSuggestion): Promise<boolean> {
  const recent = await payload.find({
    collection: 'captured-sms',
    where: {
      and: [
        { user: { equals: userId } },
        { merchantKey: { equals: merchantKey } },
        { or: [{ status: { equals: 'confirmed' } }, { autoUndone: { equals: true } }] },
      ],
    },
    sort: '-receivedAt',
    limit: TRUST_STREAK,
    depth: 1,
  })
  if (recent.docs.length < TRUST_STREAK) return false
  return recent.docs.every((d) => {
    const tx = d.transaction as Record<string, unknown> | null
    if (d.autoUndone || d.status !== 'confirmed' || !tx || typeof tx !== 'object') return false
    const tags = Array.isArray(tx.tags) ? (tx.tags as unknown[]).map(idOf).filter((x): x is string => !!x) : []
    return (
      tx.type === s.type &&
      String(tx.title ?? '').trim() === s.title.trim() &&
      idOf(tx.category) === s.category &&
      idOf(tx.person) === s.person &&
      sameSet(tags, s.tags)
    )
  })
}
