import { APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import type { ParsedSms } from './parse'
import { defaultNote, normPayee, payeeTokens, type SmsSuggestion } from './ingest'

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

const words = (s: string) => new Set(normPayee(s).split(/[^a-z]+/).filter((w) => w.length >= 3))

/**
 * Whether an SMS payee can safely be remembered as this person: a UPI ID, or a name
 * sharing a word with theirs. A shop paid on someone's behalf ("HOTEL AKSHAY" with
 * person Ashar) is not.
 */
export function payeeBelongsTo(merchant: string, personName: string): boolean {
  if (merchant.includes('@')) return true
  const theirs = words(personName)
  return [...words(merchant)].some((w) => theirs.has(w))
}

/** Adds the SMS payee to the person's UPI IDs / SMS names, so the next SMS finds them. */
async function learnPayee(payload: Payload, user: User, personId: string, merchant: string | null) {
  if (!merchant) return
  const person = await payload.findByID({ collection: 'people', id: personId, depth: 0, user, overrideAccess: false })
  const tokens = payeeTokens(person.upiIds)
  if (tokens.includes(normPayee(merchant)) || !payeeBelongsTo(merchant, person.name)) return
  const upiIds = [person.upiIds?.trim(), merchant.trim()].filter(Boolean).join(', ')
  await payload.update({ collection: 'people', id: personId, data: { upiIds }, user, overrideAccess: false })
}

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

  const person = type === 'transfer' ? null : overrides.person !== undefined ? overrides.person : s.person ?? null

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
      person,
      tags: overrides.tags ?? s.tags ?? [],
      shares: type === 'expense' ? overrides.shares ?? s.shares ?? [] : [],
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

  if (person) await learnPayee(payload, user, person, parsed.merchant)

  await payload.update({
    collection: 'captured-sms',
    id,
    user,
    overrideAccess: false,
    data: { status: 'confirmed', transaction: tx.id, account, autoUndone: false },
  })
  return { transaction: String(tx.id), linked }
}

/**
 * Reverses an auto-confirm: deletes the transaction it created and puts the SMS back
 * in the pending queue. The merchant stops being auto-confirmed until confirmed again.
 */
export async function undoAutoConfirmedSms(payload: Payload, user: User, id: string): Promise<void> {
  const sms = await loadOwn(payload, user, id)
  if (!sms.autoConfirmed || sms.status !== 'confirmed') throw new APIError('This SMS was not added automatically.', 409)
  const tx = idOf(sms.transaction)
  await payload.update({
    collection: 'captured-sms',
    id,
    user,
    overrideAccess: false,
    data: { status: 'pending', transaction: null, autoConfirmed: false, autoUndone: true },
  })
  if (tx) await payload.delete({ collection: 'transactions', id: tx, user, overrideAccess: false })
}

export async function dismissCapturedSms(payload: Payload, user: User, id: string): Promise<void> {
  const sms = await loadOwn(payload, user, id)
  if (sms.status === 'confirmed') throw new APIError('This SMS is already confirmed.', 409)
  await payload.update({ collection: 'captured-sms', id, user, overrideAccess: false, data: { status: 'dismissed' } })
}
