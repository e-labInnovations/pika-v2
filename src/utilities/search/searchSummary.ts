import type { Payload, Where } from 'payload'

/**
 * Totals for a search: the app sends the same `where` it uses for the result list
 * (GraphQL shape: `AND`/`OR`, nested paths as `shares__person`), so the totals always
 * describe exactly the listed transactions. Amounts are counted in full, as in the
 * other analytics (an expense split with friends counts its whole amount).
 */
export type SearchSummary = {
  count: number
  spent: number
  received: number
  /** Average expense amount; 0 without expenses. */
  averageSpend: number
  /** Expenses per local month, the 12 months up to `now`, oldest first. */
  months: { month: string; spent: number }[]
  /** The where actually run (Local API shape, scoped to the user). */
  where: Where
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** GraphQL where → Local API where: AND/OR → and/or, `a__b` → `a.b`. */
export function toLocalWhere(where: unknown): Where {
  if (Array.isArray(where)) return where.map(toLocalWhere) as unknown as Where
  if (!where || typeof where !== 'object') return where as Where
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(where as Record<string, unknown>)) {
    const key = k === 'AND' ? 'and' : k === 'OR' ? 'or' : k.replace(/__/g, '.')
    out[key] = key === 'and' || key === 'or' ? (v as unknown[]).map(toLocalWhere) : toLocalWhere(v)
  }
  return out as Where
}

export async function searchSummary(
  payload: Payload,
  userId: string,
  where: Record<string, unknown> | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): Promise<SearchSummary> {
  // Always the user's own rows, whatever the client sent.
  const scoped: Where = {
    and: [{ user: { equals: userId } }, ...(where && Object.keys(where).length ? [toLocalWhere(where)] : [])],
  }
  const res = await payload.find({
    collection: 'transactions',
    where: scoped,
    pagination: false,
    depth: 0,
    select: { type: true, amount: true, amountValue: true, date: true },
  })

  // A timezone never set is stored as UTC; the app's users are in India.
  const zone = !timeZone || timeZone === 'UTC' ? 'Asia/Kolkata' : timeZone
  const monthOf = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' })
  const key = (d: Date) => monthOf.format(d).slice(0, 7)
  const months: { month: string; spent: number }[] = []
  const [y, m] = key(now).split('-').map(Number)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 15))
    months.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, spent: 0 })
  }
  const byMonth = new Map(months.map((x) => [x.month, x]))

  let spent = 0
  let received = 0
  let expenses = 0
  for (const t of res.docs) {
    const amount = typeof t.amountValue === 'number' ? t.amountValue : Number(t.amount) || 0
    if (t.type === 'expense') {
      spent += amount
      expenses++
      const bucket = byMonth.get(key(new Date(t.date as string)))
      if (bucket) bucket.spent += amount
    } else if (t.type === 'income') {
      received += amount
    }
  }
  for (const b of months) b.spent = r2(b.spent)

  return {
    count: res.docs.length,
    spent: r2(spent),
    received: r2(received),
    averageSpend: expenses ? r2(spent / expenses) : 0,
    months,
    where: scoped,
  }
}
