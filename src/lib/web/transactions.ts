import type { Payload, Where } from 'payload'

import type { Transaction, User } from '@/payload-types'
import { parseLocalDate } from '@/utilities/mcp/time'
import { searchSummary, type SearchSummary } from '@/utilities/search/searchSummary'
import { PAGE_SIZE, SORT_FIELD, toWhere, type TxQuery } from './filters'

export type LookupItem = {
  id: string
  name: string
  archived: boolean
  icon?: string | null
  color?: string | null
  bgColor?: string | null
  /** People and accounts: their photo. */
  avatarUrl?: string | null
  /** Categories only. */
  parentId?: string | null
  type?: string | null
}

export type Lookups = {
  categories: LookupItem[]
  tags: LookupItem[]
  people: LookupItem[]
  accounts: LookupItem[]
  childrenOf: (categoryId: string) => string[]
}

const avatarOf = (d: { avatar?: unknown }) =>
  d.avatar && typeof d.avatar === 'object' ? ((d.avatar as { thumbnailURL?: string | null; url?: string | null }).thumbnailURL || (d.avatar as { url?: string | null }).url || null) : null

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

/** Everything the user can filter by, archived included (flagged). */
export async function loadLookups(payload: Payload, user: User): Promise<Lookups> {
  const as = { user, overrideAccess: false as const, pagination: false as const, depth: 0, sort: 'name' }
  // Explicitly the user's own (plus shared system categories/tags): access control alone
  // lets an admin read everyone's.
  const mine: Where = { user: { equals: user.id } }
  const system = await payload.find({ collection: 'users', where: { role: { equals: 'system' } }, depth: 0, limit: 20, select: { email: true }, overrideAccess: true })
  const mineOrSystem: Where = { or: [mine, ...(system.docs.length ? [{ user: { in: system.docs.map((u) => u.id) } }] : [])] }
  const [cats, tags, people, accounts] = await Promise.all([
    payload.find({ collection: 'categories', where: mineOrSystem, ...as }),
    payload.find({ collection: 'tags', where: mineOrSystem, ...as }),
    payload.find({ collection: 'people', where: mine, ...as, depth: 1 }),
    payload.find({ collection: 'accounts', where: mine, ...as, depth: 1 }),
  ])
  const item = (d: { id: unknown; name?: unknown; isActive?: boolean | null; icon?: unknown; color?: unknown; bgColor?: unknown }): LookupItem => ({
    id: String(d.id),
    name: String(d.name ?? ''),
    archived: d.isActive === false,
    icon: (d.icon as string) ?? null,
    color: (d.color as string) ?? null,
    bgColor: (d.bgColor as string) ?? null,
  })
  const categories = cats.docs.map((c) => ({ ...item(c), parentId: idOf(c.parent), type: c.type ?? null }))
  // A category under an archived parent counts as archived too.
  const archivedParents = new Set(categories.filter((c) => !c.parentId && c.archived).map((c) => c.id))
  for (const c of categories) if (c.parentId && archivedParents.has(c.parentId)) c.archived = true
  const kids = new Map<string, string[]>()
  for (const c of categories) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id])
  return {
    categories,
    tags: tags.docs.map(item),
    people: people.docs.map((d) => ({ ...item(d), avatarUrl: avatarOf(d) })),
    accounts: accounts.docs.map((d) => ({ ...item(d), avatarUrl: avatarOf(d) })),
    childrenOf: (id) => kids.get(id) ?? [],
  }
}

export type TxPage = { docs: Transaction[]; totalDocs: number; totalPages: number; page: number; where: Where; summary: SearchSummary }

/** One page of the user's transactions for the query, plus totals over every match. */
export async function listTransactions(payload: Payload, user: User, q: TxQuery, tz: string, lookups: Pick<Lookups, 'childrenOf'>): Promise<TxPage> {
  const where = toWhere(q, { userId: String(user.id), timeZone: tz, childrenOf: lookups.childrenOf })
  const [res, summary] = await Promise.all([
    payload.find({ collection: 'transactions', where, sort: [SORT_FIELD[q.sort], '-createdAt'], limit: PAGE_SIZE, page: q.page, depth: 1, user, overrideAccess: false }),
    searchSummary(payload, String(user.id), where as Record<string, unknown>, tz),
  ])
  return { docs: res.docs as Transaction[], totalDocs: res.totalDocs, totalPages: res.totalPages, page: q.page, where, summary }
}

export type TxEdit = {
  title?: string
  note?: string
  /** Local time: "YYYY-MM-DD HH:mm" (or YYYY-MM-DD). */
  date?: string
  amount?: number
  category?: string
  tags?: string[]
  person?: string | null
  account?: string
}

const ownerOf = (doc: { user?: unknown }) => idOf(doc.user)

/** The user's own transaction (depth 2), or null — also for an admin looking at someone else's. */
export async function getOwnTransaction(payload: Payload, user: User, id: string): Promise<Transaction | null> {
  const tx = await payload.findByID({ collection: 'transactions', id, depth: 2, user, overrideAccess: false }).catch(() => null)
  return tx && ownerOf(tx) === String(user.id) ? (tx as Transaction) : null
}

/** Saves the user's own transaction; anyone else's (even for an admin) is refused. */
export async function editTransaction(payload: Payload, user: User, id: string, input: TxEdit, tz: string): Promise<{ ok: true } | { error: string }> {
  const own = await payload.findByID({ collection: 'transactions', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!own || ownerOf(own) !== String(user.id)) return { error: 'Transaction not found.' }
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) {
    if (!input.title.trim()) return { error: 'Title is required.' }
    data.title = input.title.trim()
  }
  if (input.note !== undefined) data.note = input.note
  if (input.amount !== undefined) {
    if (!(Number.isFinite(input.amount) && input.amount > 0)) return { error: 'Amount must be more than 0.' }
    data.amount = String(input.amount)
  }
  if (input.date !== undefined) {
    try {
      data.date = parseLocalDate(input.date, tz).toISOString()
    } catch {
      return { error: 'Date must look like 2026-11-08 14:30.' }
    }
  }
  if (input.category !== undefined) data.category = input.category
  if (input.tags !== undefined) data.tags = input.tags
  if (input.person !== undefined) data.person = input.person
  if (input.account !== undefined) data.account = input.account
  try {
    await payload.update({ collection: 'transactions', id, data, user, overrideAccess: false, depth: 0 })
    return { ok: true }
  } catch (e) {
    const status = (e as { status?: number }).status
    return { error: status === 403 || status === 404 ? 'Transaction not found.' : e instanceof Error ? e.message : 'Could not save.' }
  }
}

export type TxNew = {
  type: 'expense' | 'income' | 'transfer'
  title: string
  amount: number
  /** Local time: "YYYY-MM-DD HH:mm". */
  date: string
  category: string
  account: string
  toAccount?: string | null
  person?: string | null
  tags: string[]
  note?: string
}

/** Adds a transaction for the user. Every id must be one of theirs (or a shared system category/tag). */
export async function createTransaction(payload: Payload, user: User, input: TxNew, tz: string): Promise<{ id: string } | { error: string }> {
  if (!['expense', 'income', 'transfer'].includes(input.type)) return { error: 'Choose expense, income or transfer.' }
  if (!input.title?.trim()) return { error: 'Title is required.' }
  if (!(Number.isFinite(input.amount) && input.amount > 0)) return { error: 'Amount must be more than 0.' }
  let date: string
  try {
    date = parseLocalDate(input.date, tz).toISOString()
  } catch {
    return { error: 'Date must look like 2026-11-08 14:30.' }
  }
  const l = await loadLookups(payload, user)
  const has = (list: LookupItem[], id?: string | null) => !!id && list.some((x) => x.id === id)
  const cat = l.categories.find((c) => c.id === input.category)
  if (!cat || !cat.parentId || cat.type !== input.type) return { error: `Choose a ${input.type} category.` }
  if (!has(l.accounts, input.account)) return { error: 'Choose one of your accounts.' }
  if (input.type === 'transfer') {
    if (!has(l.accounts, input.toAccount)) return { error: 'Choose the account the money goes to.' }
    if (input.toAccount === input.account) return { error: 'The two accounts must be different.' }
  }
  if (input.person && (input.type === 'transfer' || !has(l.people, input.person))) return { error: 'Choose one of your people.' }
  if (input.tags.some((t) => !has(l.tags, t))) return { error: 'Choose your own tags.' }
  try {
    const doc = await payload.create({
      collection: 'transactions',
      data: {
        type: input.type,
        title: input.title.trim(),
        amount: String(input.amount),
        date,
        category: input.category,
        account: input.account,
        ...(input.type === 'transfer' ? { toAccount: input.toAccount } : input.person ? { person: input.person } : {}),
        tags: input.tags,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        source: 'manual',
      } as never,
      user,
      overrideAccess: false,
      depth: 0,
    })
    return { id: String(doc.id) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
}

/** Moves the user's own transaction to the trash (restorable from the admin panel). */
export async function trashTransaction(payload: Payload, user: User, id: string): Promise<{ ok: true } | { error: string }> {
  const own = await payload.findByID({ collection: 'transactions', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!own || ownerOf(own) !== String(user.id)) return { error: 'Transaction not found.' }
  try {
    await payload.update({ collection: 'transactions', id, data: { deletedAt: new Date().toISOString() } as never, user, overrideAccess: false, depth: 0 })
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not delete.' }
  }
}
