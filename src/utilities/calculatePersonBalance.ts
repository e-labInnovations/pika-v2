import type { Payload } from 'payload'

export type OpenShare = {
  transaction: string
  title: string
  date: string | null
  share: number
  paid: number
  remaining: number
}

export type PersonBalanceResult = {
  balance: number
  totalTransactions: number
  lastTransactionAt: string | null
  totalSummary: {
    totalSpent: number
    totalReceived: number
  }
  /** Shared payments this person has not fully paid back yet, oldest first. */
  openShares: OpenShare[]
}

type BalanceTx = {
  id: string
  type: string
  amount: string | number
  date?: string | null
}

/** One person's share of a shared expense (an entry in `transactions.shares`). */
export type ShareEntry = {
  transaction: string
  title: string
  amount: string | number
  date?: string | null
}

/** An income from this person linked (`repaid`/`returned`) to a shared expense. */
export type SharePayback = {
  income: string
  transaction: string
  amount: string | number
  date?: string | null
}

type ShareRow = { person?: unknown; amount?: string | number | null }

const round4 = (n: number) => Math.round(n * 10000) / 10000
const num = (v: unknown) => parseFloat(String(v ?? '')) || 0
const idOf = (v: unknown) => String(typeof v === 'object' && v !== null ? (v as { id: string }).id : v)

/** This person's entries in a transaction's `shares` array. */
export function sharesFor(shares: ShareRow[] | null | undefined, personId: string): ShareRow[] {
  return (shares ?? []).filter((s) => s.person != null && idOf(s.person) === personId)
}

/**
 * Pure balance math, separated from the database lookups so it can be unit-tested.
 *
 * - income tagged with the person → +amount (you owe them), unless listed in
 *   `splitPaybackIds`: an old-style payback of their share of a payment that recorded
 *   no share for them. That share was owed and is now settled, so it adds nothing.
 * - expense tagged with the person → −amount (they owe you)
 * - a share of a shared expense → −share (they owe you); their payback, linked to that
 *   expense and tagged with them, is an ordinary income and cancels it.
 */
export function sumPersonBalance(
  txs: BalanceTx[],
  splitPaybackIds: ReadonlySet<string> = new Set(),
  shares: ShareEntry[] = [],
): Omit<PersonBalanceResult, 'totalTransactions' | 'openShares'> {
  let balance = 0
  let totalSpent = 0
  let totalReceived = 0
  let lastTransactionAt: string | null = null
  const track = (date?: string | null) => {
    if (date && (!lastTransactionAt || date > lastTransactionAt)) lastTransactionAt = date
  }

  for (const tx of txs) {
    const amount = num(tx.amount)
    if (tx.type === 'income') {
      if (!splitPaybackIds.has(tx.id)) balance += amount
      totalReceived += amount
    } else if (tx.type === 'expense') {
      balance -= amount
      totalSpent += amount
    }
    track(tx.date)
  }

  for (const s of shares) {
    const amount = num(s.amount)
    balance -= amount
    totalSpent += amount
    track(s.date)
  }

  return {
    balance: round4(balance),
    lastTransactionAt,
    totalSummary: {
      totalSpent: round4(totalSpent),
      totalReceived: round4(totalReceived),
    },
  }
}

/**
 * Which shares are still unpaid. Each payback is spent on the shares it is linked to,
 * oldest share first; a payback linked to several shares is split across them.
 */
export function computeOpenShares(shares: ShareEntry[], paybacks: SharePayback[]): OpenShare[] {
  const left = new Map<string, number>()
  for (const p of paybacks) left.set(p.income, num(p.amount))

  const sorted = [...shares].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  const open: OpenShare[] = []
  for (const s of sorted) {
    const share = num(s.amount)
    let paid = 0
    for (const p of paybacks) {
      if (p.transaction !== s.transaction || paid >= share) continue
      const take = Math.min(left.get(p.income) ?? 0, share - paid)
      paid += take
      left.set(p.income, (left.get(p.income) ?? 0) - take)
    }
    const remaining = round4(share - paid)
    if (remaining > 0)
      open.push({ transaction: s.transaction, title: s.title, date: s.date ?? null, share: round4(share), paid: round4(paid), remaining })
  }
  return open
}

/**
 * Calculates the running balance between the current user and a person.
 *
 * Resulting balance interpretation:
 *  - balance > 0 → you owe the person
 *  - balance < 0 → the person owes you
 *
 * See sumPersonBalance for the rules. Transfers are excluded — the person field is
 * hidden on transfer transactions.
 */
export async function calculatePersonBalance(
  payload: Payload,
  personId: string,
): Promise<PersonBalanceResult> {
  const [result, shared] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: {
        and: [{ person: { equals: personId } }, { type: { not_equals: 'transfer' } }],
      },
      limit: 0,
      depth: 0,
      pagination: false,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        and: [{ 'shares.person': { equals: personId } }, { type: { equals: 'expense' } }],
      },
      limit: 0,
      depth: 0,
      pagination: false,
    }),
  ])

  const incomes = result.docs.filter((tx) => tx.type === 'income')
  const { splitPaybackIds, sharePaybacks } = await classifyPaybacks(
    payload,
    incomes.map((tx) => ({ id: String(tx.id), person: personId, amount: tx.amount, date: tx.date as string })),
  )

  const shares: ShareEntry[] = shared.docs.flatMap((tx) =>
    sharesFor(tx.shares as ShareRow[], personId).map((s) => ({
      transaction: String(tx.id),
      title: tx.title as string,
      amount: s.amount ?? 0,
      date: tx.date as string,
    })),
  )
  const ownIds = new Set(result.docs.map((tx) => String(tx.id)))

  return {
    ...sumPersonBalance(result.docs as BalanceTx[], splitPaybackIds, shares),
    totalTransactions: result.totalDocs + shared.docs.filter((tx) => !ownIds.has(String(tx.id))).length,
    openShares: computeOpenShares(shares, sharePaybacks),
  }
}

type IncomeRef = { id: string; person: string; amount?: string | number | null; date?: string | null }

/**
 * Sorts incomes linked as `repaid`/`returned` to an expense:
 *  - `sharePaybacks`: the expense holds a share for the income's person, so the income
 *    pays that share back (counts normally, and reduces the open share).
 *  - `splitPaybackIds`: the expense has no share for them and is not tagged with them —
 *    an old-style split payback that settles itself and adds nothing to the balance.
 * A link to a deleted expense is in neither, so that income keeps counting.
 */
export async function classifyPaybacks(
  payload: Payload,
  incomes: IncomeRef[],
): Promise<{ splitPaybackIds: Set<string>; sharePaybacks: SharePayback[] }> {
  const empty = { splitPaybackIds: new Set<string>(), sharePaybacks: [] as SharePayback[] }
  if (incomes.length === 0) return empty
  const byId = new Map(incomes.map((i) => [i.id, i]))

  const links = await payload.find({
    collection: 'transaction-links',
    where: {
      and: [{ from: { in: [...byId.keys()] } }, { type: { in: ['repaid', 'returned'] } }],
    },
    limit: 0,
    depth: 0,
    pagination: false,
  })
  if (links.docs.length === 0) return empty

  const targets = await payload.find({
    collection: 'transactions',
    where: { id: { in: [...new Set(links.docs.map((l) => idOf(l.to)))] } },
    limit: 0,
    depth: 0,
    pagination: false,
  })
  const target = new Map(targets.docs.map((t) => [String(t.id), t]))

  const splitPaybackIds = new Set<string>()
  const sharePaybacks: SharePayback[] = []
  for (const l of links.docs) {
    const income = byId.get(idOf(l.from))
    const t = target.get(idOf(l.to))
    if (!income || !t) continue
    if (sharesFor(t.shares as ShareRow[], income.person).length > 0) {
      sharePaybacks.push({ income: income.id, transaction: String(t.id), amount: income.amount ?? 0, date: income.date })
    } else if ((t.person ? idOf(t.person) : null) !== income.person) {
      splitPaybackIds.add(income.id)
    }
  }
  return { splitPaybackIds, sharePaybacks }
}

/** Old-style split paybacks among the given incomes. Used by the monthly people analytics. */
export async function findSplitPaybackIds(
  payload: Payload,
  incomes: { id: string; person: string }[],
): Promise<Set<string>> {
  return (await classifyPaybacks(payload, incomes)).splitPaybackIds
}
