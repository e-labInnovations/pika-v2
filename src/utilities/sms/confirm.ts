import { APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import type { ParsedSms } from './parse'
import { defaultNote, type SmsSuggestion } from './ingest'

/** Fields the user may change before confirming. Anything omitted comes from the suggestion. */
export type ConfirmOverrides = Partial<{
  title: string
  type: ParsedSms['type']
  category: string
  account: string
  toAccount: string | null
  person: string | null
  tags: string[]
  note: string
  shares: { person: string; amount: string }[]
  /** Normally the bank's amount and time; editable for the rare SMS that gets them wrong. */
  amount: string
  date: string
  attachments: string[]
}>

const idOf = (v: unknown): string | null =>
  v == null ? null : String(typeof v === 'object' ? (v as { id: string }).id : v)

async function loadOwn(payload: Payload, user: User, id: string) {
  // Access control applies: a user can only act on their own captured SMS.
  return payload.findByID({ collection: 'captured-sms', id, depth: 0, user, overrideAccess: false })
}

/**
 * Turns a pending SMS into a transaction (source "sms", externalRef = bank ref) and
 * marks it confirmed. A Pluxee refund is also linked (`returned`) to the purchase it
 * reverses, when that purchase is found on the same account within two minutes.
 */
export async function confirmCapturedSms(
  payload: Payload,
  user: User,
  id: string,
  overrides: ConfirmOverrides = {},
): Promise<{ transaction: string; linked: string | null }> {
  const sms = await loadOwn(payload, user, id)
  if (sms.status !== 'pending') throw new APIError(`This SMS is ${sms.status}, not pending.`, 409)
  const parsed = sms.parsed as ParsedSms | null
  if (!parsed) throw new APIError('This SMS could not be parsed.', 422)
  const s = (sms.suggestion ?? {}) as Partial<SmsSuggestion>

  const type = overrides.type ?? s.type ?? parsed.type
  const category = overrides.category ?? s.category ?? null
  const account = overrides.account ?? idOf(sms.account)
  const toAccount = type === 'transfer' ? (overrides.toAccount ?? s.toAccount ?? null) : null
  if (!category) throw new APIError('Pick a category before confirming.', 400, { code: 'category_required' })
  if (!account) throw new APIError('Pick the account this SMS belongs to.', 400, { code: 'account_required' })
  if (type === 'transfer' && !toAccount) throw new APIError('Pick the account the money went to.', 400, { code: 'to_account_required' })

  const tx = await payload.create({
    collection: 'transactions',
    user,
    overrideAccess: false,
    data: {
      title: overrides.title ?? s.title ?? 'Transaction',
      amount: overrides.amount ?? parsed.amount,
      date: overrides.date ?? parsed.occurredAt ?? (sms.receivedAt as string),
      attachments: overrides.attachments ?? [],
      type,
      category,
      account,
      toAccount,
      person: type === 'transfer' ? null : (overrides.person !== undefined ? overrides.person : s.person ?? null),
      tags: overrides.tags ?? s.tags ?? [],
      shares: type === 'expense' ? overrides.shares ?? [] : [],
      note: overrides.note ?? defaultNote(parsed),
      source: 'sms',
      externalRef: parsed.ref,
    } as any,
  })

  let linked: string | null = null
  if (parsed.reversalOf) {
    const at = new Date(parsed.reversalOf).getTime()
    const original = await payload.find({
      collection: 'transactions',
      user,
      overrideAccess: false,
      where: {
        and: [
          { account: { equals: account } },
          { type: { equals: 'expense' } },
          { date: { greater_than_equal: new Date(at - 120_000).toISOString() } },
          { date: { less_than_equal: new Date(at + 120_000).toISOString() } },
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (original.docs[0]) {
      linked = String(original.docs[0].id)
      await payload.create({
        collection: 'transaction-links',
        user,
        overrideAccess: false,
        data: { from: tx.id, to: linked, type: 'returned', note: 'Refund from SMS' } as any,
      })
    }
  }

  await payload.update({
    collection: 'captured-sms',
    id,
    user,
    overrideAccess: false,
    data: { status: 'confirmed', transaction: tx.id, account },
  })
  return { transaction: String(tx.id), linked }
}

export async function dismissCapturedSms(payload: Payload, user: User, id: string): Promise<void> {
  const sms = await loadOwn(payload, user, id)
  if (sms.status === 'confirmed') throw new APIError('This SMS is already confirmed.', 409)
  await payload.update({ collection: 'captured-sms', id, user, overrideAccess: false, data: { status: 'dismissed' } })
}
