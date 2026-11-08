import type { Payload, Where } from 'payload'
import type { User } from '@/payload-types'
import { findPossibleDuplicates } from '../duplicates'
import { searchSummary } from '../search/searchSummary'
import { loadContext, type Ctx } from './context'
import { makeResolver } from './resolve'
import { formatLocal, localDayBound, parseLocalDate, zoneOf } from './time'

type TxType = 'income' | 'expense' | 'transfer'

export type AddItem = {
  title: string
  amount: number | string
  /** Local "YYYY-MM-DD" / "YYYY-MM-DD HH:mm", or ISO with Z/offset. */
  date: string
  type: TxType
  account: string
  to_account?: string | null
  category: string
  tags?: string[]
  person?: string | null
  note?: string | null
  /** Friends' shares of an expense: who owes you how much. */
  shares?: { person: string; amount: number | string }[]
  /** Save even if it looks like an existing transaction. */
  allow_duplicate?: boolean
}

export type UpdateItem = Partial<Omit<AddItem, 'allow_duplicate'>> & { id: string }

export type ItemResult = {
  index: number
  status: 'created' | 'would_create' | 'updated' | 'deleted' | 'duplicate' | 'error'
  id?: string
  errors?: string[]
  duplicate_of?: { id: string; title: string; amount: string; date: string }
  saved?: Record<string, unknown>
}

export const MAX_BATCH = 50

const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null
const money = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** Turns names into ids, local times into UTC; collects every problem with the item. */
function buildData(item: Partial<AddItem>, ctx: Ctx, base: { type?: TxType } = {}, partial = false) {
  const r = makeResolver(ctx)
  const errors: string[] = []
  const data: Record<string, unknown> = {}
  const type = (item.type ?? base.type) as TxType | undefined

  if (item.type !== undefined) {
    if (!['income', 'expense', 'transfer'].includes(item.type)) errors.push('type must be income, expense or transfer.')
    else data.type = item.type
  } else if (!partial) errors.push('type is required.')

  if (item.title !== undefined) {
    if (!String(item.title).trim()) errors.push('title is empty.')
    else data.title = String(item.title).trim()
  } else if (!partial) errors.push('title is required.')

  if (item.amount !== undefined) {
    const a = money(item.amount)
    if (a == null) errors.push('amount must be a positive number.')
    else data.amount = a.toFixed(2)
  } else if (!partial) errors.push('amount is required.')

  if (item.date !== undefined) {
    try {
      data.date = parseLocalDate(item.date, zoneOf(ctx.timezone)).toISOString()
    } catch (e: any) {
      errors.push(e.message)
    }
  } else if (!partial) errors.push('date is required (local "YYYY-MM-DD HH:mm").')

  const one = (v: string | null | undefined, f: (x: string) => { id: string } | { error: string }, key: string) => {
    if (v === undefined) return
    if (v === null || v === '') return void (data[key] = null)
    const res = f(v)
    if ('error' in res) errors.push(res.error)
    else data[key] = res.id
  }
  one(item.account, r.account, 'account')
  if (!partial && item.account === undefined) errors.push('account is required.')
  if (item.category !== undefined) {
    if (!type) errors.push('type is needed to pick the category.')
    else one(item.category, (v) => r.category(v, type), 'category')
  } else if (!partial) errors.push('category is required.')
  one(item.person, r.person, 'person')

  if (type === 'transfer') {
    one(item.to_account, r.account, 'toAccount')
    if (!partial && !item.to_account) errors.push('to_account is required for a transfer.')
  } else if (item.to_account) errors.push('to_account is only for transfers.')

  if (item.tags !== undefined) {
    const ids: string[] = []
    for (const t of item.tags ?? []) {
      const res = r.tag(t)
      if ('error' in res) errors.push(res.error)
      else ids.push(res.id)
    }
    data.tags = ids
  }
  if (item.note !== undefined) data.note = item.note ?? ''

  if (item.shares !== undefined) {
    if (type !== 'expense' && (item.shares ?? []).length) errors.push('shares are only for expenses.')
    const shares: { person: string; amount: string }[] = []
    for (const s of item.shares ?? []) {
      const who = r.person(s.person)
      const a = money(s.amount)
      if ('error' in who) errors.push(who.error)
      else if (a == null) errors.push(`share for "${s.person}" needs a positive amount.`)
      else shares.push({ person: who.id, amount: a.toFixed(2) })
    }
    data.shares = shares
  }
  return { data, errors }
}

function describe(doc: Record<string, unknown>, ctx: Ctx) {
  const tz = zoneOf(ctx.timezone)
  const cat = ctx.categories.find((c) => c.id === idOf(doc.category))
  const name = (list: { id: string; name: string }[], v: unknown) => list.find((x) => x.id === idOf(v))?.name ?? null
  return {
    id: String(doc.id),
    date: formatLocal(String(doc.date), tz),
    title: doc.title,
    type: doc.type,
    amount: Number(doc.amount),
    category: cat ? `${cat.parent ? `${cat.parent} > ` : ''}${cat.name}` : null,
    account: name(ctx.accounts, doc.account),
    ...(doc.toAccount ? { to_account: name(ctx.accounts, doc.toAccount) } : {}),
    ...(doc.person ? { person: name(ctx.people, doc.person) } : {}),
    tags: (Array.isArray(doc.tags) ? doc.tags : []).map((t) => name(ctx.tags, t)).filter(Boolean),
    ...(Array.isArray(doc.shares) && doc.shares.length
      ? { shares: (doc.shares as { person: unknown; amount: unknown }[]).map((s) => ({ person: name(ctx.people, s.person), amount: Number(s.amount) })) }
      : {}),
    ...(doc.note ? { note: doc.note } : {}),
  }
}

export async function addTransactions(
  payload: Payload,
  user: User,
  args: { transactions: AddItem[]; dry_run?: boolean },
): Promise<{ results: ItemResult[]; summary: string }> {
  const items = args.transactions ?? []
  if (!items.length) return { results: [], summary: 'Nothing to add.' }
  if (items.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} transactions per call; split the list.`)
  const ctx = await loadContext(payload, user)
  const results: ItemResult[] = []

  for (const [index, item] of items.entries()) {
    const { data, errors } = buildData(item, ctx)
    if (errors.length) {
      results.push({ index, status: 'error', errors })
      continue
    }
    if (!item.allow_duplicate) {
      const dupes = await findPossibleDuplicates(payload, String(user.id), {
        type: String(data.type),
        amount: String(data.amount),
        date: String(data.date),
        title: String(data.title),
      })
      const tx = dupes.find((d) => d.kind === 'transaction')
      if (tx) {
        results.push({
          index,
          status: 'duplicate',
          duplicate_of: { id: tx.id, title: tx.title, amount: tx.amount, date: formatLocal(tx.date, zoneOf(ctx.timezone)) },
          errors: ['Looks like an existing transaction; not saved. Set allow_duplicate: true to save anyway.'],
        })
        continue
      }
    }
    if (args.dry_run) {
      results.push({ index, status: 'would_create', saved: describe({ id: '(not saved)', ...data }, ctx) })
      continue
    }
    try {
      const doc = await payload.create({
        collection: 'transactions',
        user,
        overrideAccess: false,
        data: { tags: [], shares: [], note: '', ...data, source: 'ai' } as any,
      })
      results.push({ index, status: 'created', id: String(doc.id), saved: describe(doc as any, ctx) })
    } catch (e: any) {
      results.push({ index, status: 'error', errors: [e?.data?.errors?.map((x: any) => x.message).join('; ') || e.message] })
    }
  }
  return { results, summary: tally(results) }
}

export async function updateTransactions(
  payload: Payload,
  user: User,
  args: { transactions: UpdateItem[] },
): Promise<{ results: ItemResult[]; summary: string }> {
  const items = args.transactions ?? []
  if (items.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} transactions per call; split the list.`)
  const ctx = await loadContext(payload, user)
  const results: ItemResult[] = []
  for (const [index, { id, ...item }] of items.entries()) {
    try {
      const current = await payload.findByID({ collection: 'transactions', id, depth: 0, user, overrideAccess: false })
      const { data, errors } = buildData(item, ctx, { type: current.type as TxType }, true)
      if (errors.length) {
        results.push({ index, id, status: 'error', errors })
        continue
      }
      const doc = await payload.update({ collection: 'transactions', id, data: data as any, user, overrideAccess: false })
      results.push({ index, id, status: 'updated', saved: describe(doc as any, ctx) })
    } catch (e: any) {
      results.push({ index, id, status: 'error', errors: [e?.status === 404 ? `No transaction ${id}.` : e.message] })
    }
  }
  return { results, summary: tally(results) }
}

export async function deleteTransactions(
  payload: Payload,
  user: User,
  args: { ids: string[] },
): Promise<{ results: ItemResult[]; summary: string }> {
  const ids = args.ids ?? []
  if (ids.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} ids per call.`)
  const results: ItemResult[] = []
  for (const [index, id] of ids.entries()) {
    try {
      await payload.delete({ collection: 'transactions', id, user, overrideAccess: false })
      results.push({ index, id, status: 'deleted' })
    } catch (e: any) {
      results.push({ index, id, status: 'error', errors: [e?.status === 404 ? `No transaction ${id}.` : e.message] })
    }
  }
  return { results, summary: tally(results) }
}

function tally(results: ItemResult[]): string {
  const counts = new Map<string, number>()
  for (const r of results) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  return [...counts.entries()].map(([k, n]) => `${n} ${k}`).join(', ')
}

export type SearchArgs = {
  query?: string
  type?: TxType
  categories?: string[]
  tags?: string[]
  people?: string[]
  accounts?: string[]
  /** Local dates, inclusive. */
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest'
  limit?: number
  page?: number
}

const SORTS = { newest: '-date', oldest: 'date', highest: '-amountValue', lowest: 'amountValue' } as const

/**
 * Transactions matching text (title, note, category/tag/person/account names, an amount)
 * and filters given by name; totals over every match, rows in local time.
 */
export async function searchTransactions(payload: Payload, user: User, args: SearchArgs) {
  const ctx = await loadContext(payload, user)
  const tz = zoneOf(ctx.timezone)
  // Searching may name archived items (a past trip's tag).
  const r = makeResolver(ctx, { allowArchived: true })
  const ands: Where[] = []
  const errors: string[] = []

  const q = (args.query ?? '').trim()
  if (q) {
    const term = q.toLowerCase()
    const has = (n: string) => n.toLowerCase().includes(term)
    // A parent category name finds its subcategories.
    const cats = ctx.categories.filter((c) => has(c.name) || has(c.parent ?? '')).map((c) => c.id)
    const tags = ctx.tags.filter((t) => has(t.name)).map((t) => t.id)
    const people = ctx.people.filter((p) => has(p.name)).map((p) => p.id)
    const accounts = ctx.accounts.filter((a) => has(a.name)).map((a) => a.id)
    const amount = /^₹?\s*\d+(\.\d{1,2})?$/.test(q) ? Number(q.replace(/[₹\s]/g, '')) : NaN
    ands.push({
      or: [
        { title: { contains: q } },
        { note: { contains: q } },
        ...(cats.length ? [{ category: { in: cats } }] : []),
        ...(tags.length ? [{ tags: { in: tags } }] : []),
        ...(people.length ? [{ person: { in: people } }, { 'shares.person': { in: people } }] : []),
        ...(accounts.length ? [{ account: { in: accounts } }, { toAccount: { in: accounts } }] : []),
        ...(Number.isFinite(amount) ? [{ amountValue: { equals: amount } }] : []),
      ],
    })
  }
  if (args.type) ands.push({ type: { equals: args.type } })
  const ids = (names: string[] | undefined, f: (v: string) => { id: string } | { error: string }) =>
    (names ?? []).flatMap((n) => {
      const res = f(n)
      if ('error' in res) {
        errors.push(res.error)
        return []
      }
      return [res.id]
    })
  const catIds = (args.categories ?? []).flatMap((n) => {
    // A parent name means all of its subcategories.
    const kids = ctx.categories.filter((c) => (c.parent ?? '').toLowerCase() === n.trim().toLowerCase()).map((c) => c.id)
    if (kids.length) return kids
    const res = ['expense', 'income', 'transfer'].map((t) => r.category(n, t as TxType)).find((x) => 'id' in x)
    if (res && 'id' in res) return [res.id]
    errors.push(`No category "${n}".`)
    return []
  })
  if (catIds.length) ands.push({ category: { in: catIds } })
  const tagIds = ids(args.tags, r.tag)
  if (tagIds.length) ands.push({ tags: { in: tagIds } })
  const personIds = ids(args.people, r.person)
  if (personIds.length) ands.push({ or: [{ person: { in: personIds } }, { 'shares.person': { in: personIds } }] })
  const accountIds = ids(args.accounts, r.account)
  if (accountIds.length) ands.push({ or: [{ account: { in: accountIds } }, { toAccount: { in: accountIds } }] })
  try {
    if (args.date_from) ands.push({ date: { greater_than_equal: localDayBound(args.date_from, tz, false) } })
    if (args.date_to) ands.push({ date: { less_than_equal: localDayBound(args.date_to, tz, true) } })
  } catch (e: any) {
    errors.push(e.message)
  }
  if (args.amount_min != null) ands.push({ amountValue: { greater_than_equal: Number(args.amount_min) } })
  if (args.amount_max != null) ands.push({ amountValue: { less_than_equal: Number(args.amount_max) } })
  if (errors.length) return { errors, totals: null, transactions: [] as ReturnType<typeof describe>[] }

  const where = { and: ands } as Record<string, unknown>
  const summary = await searchSummary(payload, ctx.userId, ands.length ? where : null, tz)
  const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100)
  const page = Math.max(Number(args.page) || 1, 1)
  const rows = await payload.find({
    collection: 'transactions',
    where: summary.where,
    sort: SORTS[args.sort ?? 'newest'] ?? '-date',
    limit,
    page,
    depth: 0,
  })
  return {
    totals: { count: summary.count, spent: summary.spent, received: summary.received, average_spend: summary.averageSpend },
    spending_by_month: summary.months.filter((m) => m.spent > 0),
    page,
    pages: rows.totalPages,
    transactions: rows.docs.map((d) => describe(d as any, ctx)),
  }
}
