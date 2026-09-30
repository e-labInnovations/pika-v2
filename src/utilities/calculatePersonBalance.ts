import type { Payload } from 'payload'

export type PersonBalanceResult = {
  balance: number
  totalTransactions: number
  lastTransactionAt: string | null
  totalSummary: {
    totalSpent: number
    totalReceived: number
  }
}

type BalanceTx = {
  id: string
  type: string
  amount: string | number
  date?: string | null
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Pure balance math, separated from the database lookups so it can be unit-tested.
 *
 * `splitPaybackIds` are incomes that settle this person's share of a shared payment
 * (see calculatePersonBalance). The share was owed from the moment the payment was
 * made and is settled by this income, so it adds nothing to the balance. It still
 * counts as money received.
 */
export function sumPersonBalance(
  txs: BalanceTx[],
  splitPaybackIds: ReadonlySet<string> = new Set(),
): Omit<PersonBalanceResult, 'totalTransactions'> {
  let balance = 0
  let totalSpent = 0
  let totalReceived = 0
  let lastTransactionAt: string | null = null

  for (const tx of txs) {
    const amount = parseFloat(tx.amount as string) || 0
    const date = tx.date as string

    if (tx.type === 'income') {
      if (!splitPaybackIds.has(tx.id)) balance += amount
      totalReceived += amount
    } else if (tx.type === 'expense') {
      balance -= amount
      totalSpent += amount
    }

    if (date && (!lastTransactionAt || date > lastTransactionAt)) {
      lastTransactionAt = date
    }
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
 * Calculates the running balance between the current user and a person.
 *
 * Rules (from the user's perspective):
 *  - income  (person = id) → +amount  (they gave you money → you owe them more)
 *  - expense (person = id) → -amount  (you spent on them  → they owe you more)
 *  - income linked as `repaid` or `returned` to a payment that does not carry this person
 *    → 0 (they paid back their share of a group payment, e.g. a coffee you paid for,
 *    or sent back money you paid them)
 *
 * Resulting balance interpretation:
 *  - balance > 0 → you owe the person
 *  - balance < 0 → the person owes you
 *
 * Transfers are excluded — the person field is hidden on transfer transactions.
 */
export async function calculatePersonBalance(
  payload: Payload,
  personId: string,
): Promise<PersonBalanceResult> {
  const result = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { person: { equals: personId } },
        { type: { not_equals: 'transfer' } },
      ],
    },
    limit: 0,
    depth: 0,
    pagination: false,
  })

  const splitPaybackIds = await findSplitPaybacks(
    payload,
    personId,
    result.docs.filter((tx) => tx.type === 'income').map((tx) => String(tx.id)),
  )

  return {
    ...sumPersonBalance(result.docs as BalanceTx[], splitPaybackIds),
    totalTransactions: result.totalDocs,
  }
}

/** Incomes from this person linked as `repaid`/`returned` to a payment that is not tagged with them. */
async function findSplitPaybacks(
  payload: Payload,
  personId: string,
  incomeIds: string[],
): Promise<Set<string>> {
  if (incomeIds.length === 0) return new Set()

  const links = await payload.find({
    collection: 'transaction-links',
    where: {
      and: [{ from: { in: incomeIds } }, { type: { in: ['repaid', 'returned'] } }],
    },
    limit: 0,
    depth: 0,
    pagination: false,
  })
  if (links.docs.length === 0) return new Set()

  const idOf = (v: unknown) => String(typeof v === 'object' && v !== null ? (v as { id: string }).id : v)
  const targetIds = [...new Set(links.docs.map((l) => idOf(l.to)))]
  const targets = await payload.find({
    collection: 'transactions',
    where: { id: { in: targetIds } },
    limit: 0,
    depth: 0,
    pagination: false,
  })
  const targetPerson = new Map(targets.docs.map((t) => [String(t.id), t.person ? idOf(t.person) : null]))

  return new Set(
    links.docs
      // A deleted target settles nothing, so the income keeps counting.
      .filter((l) => targetPerson.has(idOf(l.to)) && targetPerson.get(idOf(l.to)) !== personId)
      .map((l) => idOf(l.from)),
  )
}
