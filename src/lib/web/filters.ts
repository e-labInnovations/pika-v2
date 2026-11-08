import type { Where } from 'payload'
import { localMidnight } from '@/utilities/localMonth'
import { zone } from './format'

/**
 * The transaction list's filters, kept in the URL so every view can be bookmarked.
 * Same meaning as the phone app: amounts by `amountValue`, dates by local day, a
 * parent category also means its subcategories.
 */
export type TxType = 'expense' | 'income' | 'transfer'
export type TxSort = 'newest' | 'oldest' | 'highest' | 'lowest'
export type TxQuery = {
  q?: string
  types: TxType[]
  /** YYYY-MM-DD, local */
  from?: string
  to?: string
  categories: string[]
  tags: string[]
  people: string[]
  accounts: string[]
  min?: number
  max?: number
  sort: TxSort
  /** 1-based */
  page: number
}

export const SORT_FIELD: Record<TxSort, string> = { newest: '-date', oldest: 'date', highest: '-amountValue', lowest: 'amountValue' }
export const PAGE_SIZE = 50

const TYPES: TxType[] = ['expense', 'income', 'transfer']
const SORTS = Object.keys(SORT_FIELD) as TxSort[]
const ID = /^[\w-]{1,64}$/

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined
const list = (v: string | string[] | undefined) =>
  [...new Set((Array.isArray(v) ? v.join(',') : (v ?? '')).split(',').map((s) => s.trim()).filter((s) => ID.test(s)))]

function isoDay(v: string | undefined): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined
}

function amount(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** A sane page number; anything odd (Infinity, 1e20, -3) is page 1. */
const pageOf = (v: string | undefined) => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= 1 && n <= 100_000 ? n : 1
}

export function parseTxParams(sp: Params): TxQuery {
  const q: TxQuery = {
    types: list(sp.types).filter((t): t is TxType => TYPES.includes(t as TxType)),
    categories: list(sp.categories),
    tags: list(sp.tags),
    people: list(sp.people),
    accounts: list(sp.accounts),
    sort: SORTS.includes(one(sp.sort) as TxSort) ? (one(sp.sort) as TxSort) : 'newest',
    page: pageOf(one(sp.page)),
  }
  const text = one(sp.q)?.slice(0, 200)
  if (text) q.q = text
  const from = isoDay(one(sp.from))
  const to = isoDay(one(sp.to))
  if (from) q.from = from
  if (to) q.to = to
  const min = amount(one(sp.min))
  const max = amount(one(sp.max))
  if (min !== undefined) q.min = min
  if (max !== undefined) q.max = max
  return q
}

/** Query string for a (partial) query: leading "?", defaults and empties left out. */
export function toSearch(q: Partial<TxQuery>): string {
  const p = new URLSearchParams()
  if (q.q) p.set('q', q.q)
  for (const k of ['types', 'categories', 'tags', 'people', 'accounts'] as const) {
    if (q[k]?.length) p.set(k, q[k]!.join(','))
  }
  if (q.from) p.set('from', q.from)
  if (q.to) p.set('to', q.to)
  if (q.min !== undefined) p.set('min', String(q.min))
  if (q.max !== undefined) p.set('max', String(q.max))
  if (q.sort && q.sort !== 'newest') p.set('sort', q.sort)
  if (q.page && q.page > 1) p.set('page', String(q.page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

const startOf = (day: string, tz: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return localMidnight(y, m, d, tz)
}
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

/** Local API where for the query, always limited to the user's own transactions. */
export function toWhere(q: TxQuery, ctx: { userId: string; timeZone: string; childrenOf: (categoryId: string) => string[] }): Where {
  const tz = zone(ctx.timeZone)
  const and: Where[] = [{ user: { equals: ctx.userId } }]
  if (q.q) {
    const n = /^₹?\s*\d+(\.\d{1,2})?$/.test(q.q) ? Number(q.q.replace(/[₹\s]/g, '')) : NaN
    and.push({
      or: [
        { title: { contains: q.q } },
        { note: { contains: q.q } },
        ...(Number.isFinite(n) ? [{ amountValue: { equals: n } }] : []),
      ],
    })
  }
  if (q.types.length) and.push({ type: { in: q.types } })
  if (q.categories.length) {
    const ids = [...new Set(q.categories.flatMap((id) => [id, ...ctx.childrenOf(id)]))]
    and.push({ category: { in: ids } })
  }
  if (q.tags.length) and.push({ tags: { in: q.tags } })
  if (q.people.length) and.push({ or: [{ person: { in: q.people } }, { 'shares.person': { in: q.people } }] })
  if (q.accounts.length) and.push({ or: [{ account: { in: q.accounts } }, { toAccount: { in: q.accounts } }] })
  if (q.from) and.push({ date: { greater_than_equal: startOf(q.from, tz).toISOString() } })
  if (q.to) and.push({ date: { less_than: startOf(nextDay(q.to), tz).toISOString() } })
  if (q.min !== undefined) and.push({ amountValue: { greater_than_equal: q.min } })
  if (q.max !== undefined) and.push({ amountValue: { less_than_equal: q.max } })
  return { and }
}
