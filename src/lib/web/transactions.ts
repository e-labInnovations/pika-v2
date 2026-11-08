import type { Payload, Where } from 'payload'

import type { Transaction, User } from '@/payload-types'
import { findPossibleDuplicates } from '@/utilities/duplicates'
import { parseLocalDate } from '@/utilities/mcp/time'
import { aiSplitParts, splitTransaction, type SmsPart } from '@/utilities/sms/split'
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A well-formed id (anything else would make Postgres throw on an `in` query). */
const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

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
  /** Friends' shares of an expense; [] removes them. */
  shares?: Share[]
  /** Media ids (the user's own uploads); [] removes them. */
  attachments?: string[]
}

export type Share = { person: string; amount: number | string }

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
  if (input.shares !== undefined) {
    if (!Array.isArray(input.shares) || !input.shares.every((x) => isId(x?.person))) return { error: 'Split only with your own people.' }
    if (input.shares.length) {
      const people = await payload.find({ collection: 'people', where: { and: [{ user: { equals: user.id } }, { id: { in: input.shares.map((x) => x.person) } }] }, limit: 100, depth: 0, user, overrideAccess: false })
      if (people.docs.length !== new Set(input.shares.map((x) => x.person)).size) return { error: 'Split only with your own people.' }
      if (input.shares.some((x) => !(Number(x.amount) > 0))) return { error: 'Each share must be more than 0.' }
    }
    data.shares = input.shares.map((x) => ({ person: x.person, amount: Number(x.amount).toFixed(2) }))
  }
  if (input.attachments !== undefined) {
    if (!(await ownMedia(payload, user, input.attachments))) return { error: 'Attach only your own files.' }
    data.attachments = input.attachments
  }
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
  shares?: Share[]
  attachments?: string[]
  /** Save even if it looks like an existing transaction. */
  allowDuplicate?: boolean
}

export type Duplicate = { id: string; title: string; amount: string; date: string }

/** True when every id is a media file the user uploaded. */
async function ownMedia(payload: Payload, user: User, ids: string[]): Promise<boolean> {
  if (!Array.isArray(ids)) return false
  if (!ids.length) return true
  if (!ids.every(isId)) return false
  const res = await payload.find({ collection: 'media', where: { and: [{ user: { equals: user.id } }, { id: { in: ids } }] }, limit: ids.length, depth: 0, user, overrideAccess: false })
  return res.docs.length === new Set(ids).size
}

/** Adds a transaction for the user. Every id must be one of theirs (or a shared system category/tag). */
export async function createTransaction(payload: Payload, user: User, input: TxNew, tz: string): Promise<{ id: string } | { error: string } | { duplicate: Duplicate }> {
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
  const shares = input.shares ?? []
  if (shares.length && input.type !== 'expense') return { error: 'Only expenses can be split with people.' }
  if (shares.some((x) => !has(l.people, x.person))) return { error: 'Split only with your own people.' }
  if (shares.some((x) => !(Number(x.amount) > 0))) return { error: 'Each share must be more than 0.' }
  const attachments = input.attachments ?? []
  if (!(await ownMedia(payload, user, attachments))) return { error: 'Attach only your own files.' }
  if (!input.allowDuplicate) {
    const dupes = await findPossibleDuplicates(payload, String(user.id), { type: input.type, amount: input.amount, date, title: input.title })
    const tx = dupes.find((d) => d.kind === 'transaction')
    if (tx) return { duplicate: { id: tx.id, title: tx.title, amount: tx.amount, date: tx.date } }
  }
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
        ...(attachments.length ? { attachments } : {}),
        ...(shares.length ? { shares: shares.map((x) => ({ person: x.person, amount: Number(x.amount).toFixed(2) })) } : {}),
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

export type PartIn = { title: string; amount: number | string; category: string; tags?: string[]; person?: string | null }

/**
 * Splits the user's own transaction into parts (it stays as the first part). The parts
 * must add up to its amount; every category, tag and person must be theirs.
 */
export async function splitOwnTransaction(payload: Payload, user: User, id: string, parts: PartIn[]): Promise<{ ids: string[] } | { error: string }> {
  const tx = await getOwnTransaction(payload, user, id)
  if (!tx) return { error: 'Transaction not found.' }
  if (!Array.isArray(parts) || parts.length < 2) return { error: 'Split into at least two parts.' }
  if (parts.length > 20) return { error: 'Split into at most 20 parts.' }
  if (parts.some((p) => !p || typeof p !== 'object' || (p.tags !== undefined && !Array.isArray(p.tags)))) return { error: 'Invalid parts.' }
  const l = await loadLookups(payload, user)
  const has = (list: LookupItem[], v?: string | null) => !!v && list.some((x) => x.id === v)
  for (const [i, p] of parts.entries()) {
    const cat = l.categories.find((c) => c.id === p.category)
    if (!cat || !cat.parentId || cat.type !== tx.type) return { error: `Part ${i + 1}: choose a ${tx.type} category.` }
    if (!(Number(p.amount) > 0)) return { error: `Part ${i + 1}: amount must be more than 0.` }
    if ((p.tags ?? []).some((t) => !has(l.tags, t))) return { error: `Part ${i + 1}: choose your own tags.` }
    if (p.person && !has(l.people, p.person)) return { error: `Part ${i + 1}: choose one of your people.` }
  }
  try {
    const res = await splitTransaction(
      payload,
      user,
      id,
      // Part 1 is the original transaction: unless given, it keeps its title, tags and person.
      parts.map((p, i) => ({
        title: p.title?.trim() || (i === 0 ? tx.title : `Part ${i + 1}`),
        amount: Number(p.amount).toFixed(2),
        category: p.category,
        tags: p.tags ?? (i === 0 ? (tx.tags ?? []).map(idOf).filter((x): x is string => !!x) : []),
        person: p.person !== undefined ? p.person : i === 0 ? idOf(tx.person) : null,
      })),
    )
    return { ids: res.transactions }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not split.' }
  }
}

/** The AI's suggested parts for the user's transaction (nothing saved). */
export async function suggestSplit(payload: Payload, user: User, id: string, hint: string): Promise<{ parts: SmsPart[] } | { error: string }> {
  const tx = await getOwnTransaction(payload, user, id)
  if (!tx) return { error: 'Transaction not found.' }
  const text = (typeof hint === 'string' ? hint : '').trim().slice(0, 1000)
  const about = `Transaction: ${tx.title}${tx.note ? ` (${tx.note})` : ''}, ${tx.amount}`
  try {
    const parts = await aiSplitParts(payload, String(user.id), text ? `${text}\n\n${about}` : about, String(tx.amount), String(tx.type))
    return { parts: parts as SmsPart[] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The AI could not split it.' }
  }
}
