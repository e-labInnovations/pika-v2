import { createHash } from 'crypto'
import type { Payload } from 'payload'
import { looksFinancial, parseSms, providerForSender, type ParsedSms } from './parse'
import type { User } from '@/payload-types'
import { isConfidentPrediction, predictCategoryFromHistory } from '../ai/user-history'
import { eligible, isTrusted, loadAutoConfirmSettings, type AutoConfirmSettings } from './autoConfirm'
import { confirmCapturedSms } from './confirm'

export type IncomingSms = { sender: string; body: string; receivedAt: string }

export type SmsSuggestion = {
  title: string
  type: ParsedSms['type']
  category: string | null
  tags: string[]
  person: string | null
  toAccount: string | null
  /** Friends' shares, when a reply to the notification described a split. */
  shares?: { person: string; amount: string }[]
  /** Where the suggestion came from, best first; `reply`: the user's reply to the notification. */
  from: 'sms' | 'note' | 'model' | 'default' | 'reply'
}

export type IngestResult = {
  sender: string
  receivedAt: string
  /** `auto`: confirmed on arrival (trusted merchant); `transaction` is set. */
  status: 'pending' | 'auto' | 'duplicate' | 'unparsed' | 'exists' | 'ignored'
  id?: string
  transaction?: string
  /** For new pending and auto items: enough for the phone to show a notification. */
  summary?: {
    amount: string
    type: ParsedSms['type']
    title: string
    /** Pending only: the suggestion has everything a transaction needs, so one tap can add it. */
    complete?: boolean
  }
}

const idOf = (v: unknown): string | null =>
  v == null ? null : String(typeof v === 'object' ? (v as { id: string }).id : v)
const num = (v: unknown) => parseFloat(String(v ?? '')) || 0

/** Same message from the same user → same hash, whichever sender variant (AD-/AX-/-S) delivered it. */
export function smsHash(userId: string, body: string): string {
  return createHash('sha256').update(`${userId}\n${body.replace(/\s+/g, ' ').trim()}`).digest('hex')
}

/** Merchant key for learning: case, spacing and a trailing VPA suffix don't matter. */
export function merchantKey(merchant: string | null): string | null {
  if (!merchant) return null
  const k = merchant.toUpperCase().replace(/\s+/g, ' ').trim()
  return k.length >= 3 ? k : null
}

/** Account SMS identifiers: "X7497, xx7618, pluxee-meal" → {"7497","7618","pluxee-meal"}. */
export function identifierTokens(raw: string | null | undefined): Set<string> {
  const out = new Set<string>()
  for (const t of String(raw ?? '').split(/[,\s]+/)) {
    const tok = t.trim().toLowerCase()
    if (!tok) continue
    const digits = tok.replace(/\D/g, '')
    out.add(/^x*\d+$/.test(tok) && digits.length >= 4 ? digits.slice(-4) : tok)
  }
  return out
}

const KIND_TITLE: Partial<Record<ParsedSms['kind'], string>> = {
  atm_withdrawal: 'ATM withdrawal',
  cash_deposit: 'Cash deposit',
  meal_credit: 'Meal wallet credit',
  imps_credit: 'IMPS credit',
  reversal: 'Refund',
  account_debit: 'Bank transfer',
}

/**
 * Merchants that stand for many different purchases (delivery apps, marketplaces).
 * A past transaction there tells us the category, not what was bought this time, so
 * the title stays generic.
 */
const AGGREGATORS: [RegExp, string][] = [
  [/ETERNAL|ZOMATO/i, 'Zomato order'],
  [/SWIGGY ?INST/i, 'Swiggy Instamart'],
  [/SWIGGY/i, 'Swiggy order'],
  [/BLINKIT/i, 'Blinkit order'],
  [/BB ?NOW|BIG ?BASKET/i, 'BigBasket order'],
  [/AMAZON/i, 'Amazon'],
  [/FLIPKART/i, 'Flipkart'],
  [/IRCTC/i, 'Train ticket - IRCTC'],
]
const aggregatorTitle = (merchant: string | null) =>
  merchant ? AGGREGATORS.find(([re]) => re.test(merchant))?.[1] ?? null : null

function defaultTitle(p: ParsedSms): string {
  const agg = aggregatorTitle(p.merchant)
  if (agg) return agg
  if (p.kind === 'gift_card') return p.merchant ? `Gift card from ${titleCase(p.merchant)}` : 'Gift card'
  if (KIND_TITLE[p.kind] && !p.merchant) return KIND_TITLE[p.kind]!
  if (p.kind === 'atm_withdrawal') return 'ATM withdrawal'
  if (p.merchant && !p.merchant.includes('@')) return titleCase(p.merchant)
  return p.merchant ? `UPI to ${p.merchant}` : KIND_TITLE[p.kind] ?? 'Transaction'
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** The note saved on the confirmed transaction: what the SMS said, minus the boilerplate. */
export function defaultNote(p: ParsedSms): string {
  const parts = [
    p.ref ? `Ref ${p.ref}` : null,
    p.merchant ? `${p.type === 'income' ? 'from' : 'to'} ${p.merchant}` : null,
    p.balance ? `Bal Rs ${p.balance}` : null,
  ].filter(Boolean)
  return `From SMS (${p.provider} ${p.kind.replace(/_/g, ' ')}). ${parts.join(' · ')}`.trim()
}

/** Payee as people's UPI IDs / SMS names store it: case, spacing and trailing dots don't matter. */
export const normPayee = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim()

export function payeeTokens(raw: string | null | undefined): string[] {
  return String(raw ?? '').split(',').map(normPayee).filter(Boolean)
}

export type PersonRow = { id: string; name: string; tokens: string[] }

export async function loadPeople(payload: Payload, userId: string): Promise<PersonRow[]> {
  const res = await payload.find({
    collection: 'people',
    where: { and: [{ user: { equals: userId } }, { upiIds: { exists: true } }] },
    pagination: false,
    depth: 0,
    select: { name: true, upiIds: true },
  })
  return res.docs.map((d) => ({ id: String(d.id), name: d.name as string, tokens: payeeTokens(d.upiIds as string) }))
}

/** The person whose UPI IDs / SMS names include this SMS payee. */
export function matchPerson(people: PersonRow[], merchant: string | null): PersonRow | null {
  if (!merchant) return null
  const m = normPayee(merchant)
  return people.find((p) => p.tokens.includes(m)) ?? null
}

type AccountRow = { id: string; tokens: Set<string> }

export async function loadAccounts(payload: Payload, userId: string): Promise<AccountRow[]> {
  const res = await payload.find({
    collection: 'accounts',
    where: { user: { equals: userId } },
    limit: 100,
    depth: 0,
    pagination: false,
  })
  return res.docs.map((a) => ({ id: String(a.id), tokens: identifierTokens((a as { smsIdentifiers?: string }).smsIdentifiers) }))
}

export function resolveAccount(accounts: AccountRow[], hints: string[]): string | null {
  const wanted = hints.map((h) => [...identifierTokens(h)][0]).filter(Boolean)
  // An account matching more hints wins (card digits + "pluxee-meal" beats either alone).
  let best: { id: string; score: number } | null = null
  for (const a of accounts) {
    const score = wanted.filter((h) => a.tokens.has(h)).length
    if (score > 0 && (!best || score > best.score)) best = { id: a.id, score }
  }
  return best?.id ?? null
}

/**
 * An existing transaction this SMS describes: same bank reference (in `externalRef`
 * or quoted in the note), or else same account and amount within ±15 minutes.
 */
export async function findDuplicate(
  payload: Payload,
  userId: string,
  p: ParsedSms,
  accountId: string | null,
  receivedAt: string,
): Promise<string | null> {
  if (p.ref && p.ref.length >= 6) {
    const byRef = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { or: [{ externalRef: { equals: p.ref } }, { note: { contains: p.ref } }] },
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (byRef.docs[0]) return String(byRef.docs[0].id)
  }
  if (!accountId) return null
  const at = new Date(p.occurredAt ?? receivedAt).getTime()
  const window = 15 * 60_000
  const near = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: userId } },
        { or: [{ account: { equals: accountId } }, { toAccount: { equals: accountId } }] },
        { date: { greater_than_equal: new Date(at - window).toISOString() } },
        { date: { less_than_equal: new Date(at + window).toISOString() } },
      ],
    },
    limit: 20,
    depth: 0,
  })
  const hit = near.docs.find((t) => Math.abs(num(t.amount) - num(p.amount)) < 0.005)
  return hit ? String(hit.id) : null
}

type TxLike = { title?: string; type?: string; category?: unknown; tags?: unknown; person?: unknown; toAccount?: unknown }

const fromTx = (t: TxLike, from: SmsSuggestion['from']): SmsSuggestion => ({
  title: String(t.title ?? ''),
  type: (t.type as SmsSuggestion['type']) ?? 'expense',
  category: idOf(t.category),
  tags: Array.isArray(t.tags) ? (t.tags as unknown[]).map((x) => idOf(x)!).filter(Boolean) : [],
  person: idOf(t.person),
  toAccount: idOf(t.toAccount),
  from,
})

/**
 * Prefill for the pending item, from the user's own history:
 *  1. the transaction last confirmed from an SMS with the same merchant
 *  2. else the latest transaction whose note mentions the merchant (covers entries
 *     added by hand or imported before SMS capture existed)
 *  3. else just a category, from the MiniLM k-NN over past titles
 */
export async function suggest(
  payload: Payload,
  userId: string,
  p: ParsedSms,
  people: PersonRow[] = [],
  /** Better title than the merchant when nothing was learned (e.g. a bank statement's note). */
  titleHint?: string | null,
): Promise<SmsSuggestion> {
  const key = merchantKey(p.merchant)
  // A payee saved on a person fills in the person, whichever way the rest is suggested.
  const payee = matchPerson(people, p.merchant)
  const withPerson = (s: SmsSuggestion): SmsSuggestion => (payee && !s.person ? { ...s, person: payee.id } : s)

  if (key) {
    const learned = await payload.find({
      collection: 'captured-sms',
      where: {
        and: [{ user: { equals: userId } }, { merchantKey: { equals: key } }, { status: { equals: 'confirmed' } }],
      },
      sort: '-receivedAt',
      limit: 5,
      depth: 1,
    })
    for (const c of learned.docs) {
      const tx = c.transaction as TxLike | null
      if (tx && typeof tx === 'object' && tx.type === p.type) return withPerson(fromTx(tx, 'sms'))
    }

    if (p.merchant && p.merchant.length >= 4) {
      const noted = await payload.find({
        collection: 'transactions',
        where: {
          and: [{ user: { equals: userId } }, { type: { equals: p.type } }, { note: { contains: p.merchant } }],
        },
        sort: '-date',
        limit: 1,
        depth: 0,
      })
      if (noted.docs[0]) {
        const s = fromTx(noted.docs[0] as TxLike, 'note')
        return withPerson({ ...s, title: aggregatorTitle(p.merchant) ?? s.title })
      }
    }
  }

  const title =
    payee && p.type === 'expense' ? `Paid ${payee.name}` : payee ? `From ${payee.name}` : titleHint || defaultTitle(p)
  let category: string | null = null
  let tags: string[] = []
  let person: string | null = payee?.id ?? null
  try {
    const pred = await predictCategoryFromHistory(payload, userId, { type: p.type, title })
    if (pred?.category && isConfidentPrediction(pred)) {
      category = String(pred.category.id)
      tags = pred.tags
    }
    person ??= pred?.person ?? null
  } catch {
    // The embedding model may be unavailable; the user picks a category on confirm.
  }
  return { title, type: p.type, category, tags, person, toAccount: null, from: category ? 'model' : 'default' }
}

/** Stores new SMS as pending items (or duplicates / unparsed). Re-sending the same SMS is a no-op. */
export async function ingestSms(payload: Payload, userId: string, messages: IncomingSms[]): Promise<IngestResult[]> {
  let accounts: AccountRow[] | null = null
  let people: PersonRow[] | null = null
  let auto: AutoConfirmSettings | null = null
  const results: IngestResult[] = []

  for (const msg of messages) {
    const base = { sender: msg.sender, receivedAt: msg.receivedAt }
    if (!providerForSender(msg.sender)) {
      results.push({ ...base, status: 'ignored' })
      continue
    }
    const hash = smsHash(userId, msg.body)
    const existing = await payload.find({ collection: 'captured-sms', where: { hash: { equals: hash } }, limit: 1, depth: 0 })
    if (existing.docs[0]) {
      results.push({ ...base, status: 'exists', id: String(existing.docs[0].id) })
      continue
    }

    const parsed = parseSms(msg.sender, msg.body)
    if (!parsed && !looksFinancial(msg.body)) {
      results.push({ ...base, status: 'ignored' })
      continue
    }

    let account: string | null = null
    let duplicateOf: string | null = null
    let suggestion: SmsSuggestion | null = null
    if (parsed) {
      accounts ??= await loadAccounts(payload, userId)
      account = resolveAccount(accounts, parsed.accountHints)
      duplicateOf = await findDuplicate(payload, userId, parsed, account, msg.receivedAt)
      if (!duplicateOf) {
        people ??= await loadPeople(payload, userId)
        suggestion = await suggest(payload, userId, parsed, people)
      }
    }

    const status: IngestResult['status'] = !parsed ? 'unparsed' : duplicateOf ? 'duplicate' : 'pending'
    const doc = await payload.create({
      collection: 'captured-sms',
      data: {
        user: userId,
        sender: msg.sender,
        body: msg.body,
        receivedAt: msg.receivedAt,
        hash,
        status,
        parsed: parsed ?? undefined,
        merchantKey: merchantKey(parsed?.merchant ?? null),
        suggestion: suggestion ?? undefined,
        account,
        transaction: duplicateOf,
      },
    })
    const summary =
      parsed && suggestion
        ? {
            amount: parsed.amount,
            type: suggestion.type,
            title: suggestion.title,
            complete: !!suggestion.category && !!account && (suggestion.type !== 'transfer' || !!suggestion.toAccount),
          }
        : null

    if (status === 'pending' && parsed && suggestion) {
      auto ??= await loadAutoConfirmSettings(payload, userId)
      const key = merchantKey(parsed.merchant)
      if (key && eligible(auto, parsed, suggestion, account) && (await isTrusted(payload, userId, key, suggestion))) {
        try {
          const user = (await payload.findByID({ collection: 'users', id: userId, depth: 0 })) as User
          const { transaction } = await confirmCapturedSms(payload, user, String(doc.id))
          await payload.update({ collection: 'captured-sms', id: doc.id, data: { autoConfirmed: true } })
          results.push({ ...base, status: 'auto', id: String(doc.id), transaction, summary: summary! })
          continue
        } catch (e) {
          // Leave it pending for review; the user sees it as usual.
          payload.logger.warn(`SMS auto-confirm failed for ${doc.id}: ${(e as Error).message}`)
        }
      }
    }

    results.push({
      ...base,
      status,
      id: String(doc.id),
      ...(status === 'pending' && summary ? { summary } : {}),
    })
  }
  return results
}
