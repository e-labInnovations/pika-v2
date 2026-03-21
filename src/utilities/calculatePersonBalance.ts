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

/**
 * Calculates the running balance between the current user and a person.
 *
 * Rules (from the user's perspective):
 *  - income  (person = id) → +amount  (they gave you money → you owe them more)
 *  - expense (person = id) → -amount  (you spent on them  → they owe you more)
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

  let balance = 0
  let totalSpent = 0
  let totalReceived = 0
  let lastTransactionAt: string | null = null

  for (const tx of result.docs) {
    const amount = parseFloat(tx.amount as string) || 0
    const date = tx.date as string

    if (tx.type === 'income') {
      balance += amount
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
    balance: Math.round(balance * 10000) / 10000,
    totalTransactions: result.totalDocs,
    lastTransactionAt,
    totalSummary: {
      totalSpent: Math.round(totalSpent * 10000) / 10000,
      totalReceived: Math.round(totalReceived * 10000) / 10000,
    },
  }
}
