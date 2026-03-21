import type { Payload } from 'payload'

export type AccountBalanceResult = {
  balance: number
  totalTransactions: number
  lastTransactionAt: string | null
}

/**
 * Calculates the running balance for a given account by summing all transactions.
 *
 * Rules:
 *  - income  (account = id)          → +amount
 *  - expense (account = id)          → -amount
 *  - transfer out (account = id)     → -amount
 *  - transfer in  (toAccount = id)   → +amount
 */
export async function calculateAccountBalance(
  payload: Payload,
  accountId: string,
): Promise<AccountBalanceResult> {
  const [outgoing, incoming] = await Promise.all([
    // All transactions where this account is the source
    payload.find({
      collection: 'transactions',
      where: { account: { equals: accountId } },
      limit: 0,
      depth: 0,
      pagination: false,
    }),
    // Transfer transactions where this account is the destination
    payload.find({
      collection: 'transactions',
      where: {
        and: [{ type: { equals: 'transfer' } }, { toAccount: { equals: accountId } }],
      },
      limit: 0,
      depth: 0,
      pagination: false,
    }),
  ])

  let balance = 0
  let lastTransactionAt: string | null = null

  const track = (date: string | null | undefined) => {
    if (date && (!lastTransactionAt || date > lastTransactionAt)) lastTransactionAt = date
  }

  for (const tx of outgoing.docs) {
    const amount = parseFloat(tx.amount as string) || 0
    if (tx.type === 'income') balance += amount
    else balance -= amount // expense or outgoing transfer
    track(tx.date as string)
  }

  for (const tx of incoming.docs) {
    const amount = parseFloat(tx.amount as string) || 0
    balance += amount // incoming transfer
    track(tx.date as string)
  }

  return {
    balance: Math.round(balance * 10000) / 10000,
    totalTransactions: outgoing.totalDocs + incoming.totalDocs,
    lastTransactionAt,
  }
}
