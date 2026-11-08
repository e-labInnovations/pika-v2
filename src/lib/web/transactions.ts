import type { Payload, Where } from 'payload'

import type { Transaction, User } from '@/payload-types'
import { searchSummary, type SearchSummary } from '@/utilities/search/searchSummary'
import { PAGE_SIZE, SORT_FIELD, toWhere, type TxQuery } from './filters'

export type LookupItem = {
  id: string
  name: string
  archived: boolean
  icon?: string | null
  color?: string | null
  bgColor?: string | null
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

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

/** Everything the user can filter by, archived included (flagged). */
export async function loadLookups(payload: Payload, user: User): Promise<Lookups> {
  const as = { user, overrideAccess: false as const, pagination: false as const, depth: 0, sort: 'name' }
  const [cats, tags, people, accounts] = await Promise.all([
    payload.find({ collection: 'categories', ...as }),
    payload.find({ collection: 'tags', ...as }),
    payload.find({ collection: 'people', ...as }),
    payload.find({ collection: 'accounts', ...as }),
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
    people: people.docs.map(item),
    accounts: accounts.docs.map(item),
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
