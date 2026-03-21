import type { PayloadHandler } from 'payload'
import { calculateAccountBalance } from '../utilities/calculateAccountBalance'

/**
 * GET /api/accounts/:id/balance
 * Returns the account with calculated balance, totalTransactions, and lastTransactionAt.
 */
export const accountBalanceHandler: PayloadHandler = async (req) => {
  const { payload, routeParams, user } = req

  if (!user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const id = routeParams?.id as string

  const account = await payload.findByID({
    collection: 'accounts',
    id,
    depth: 1,
    overrideAccess: false,
    req,
  })

  const balanceData = await calculateAccountBalance(payload, id)

  return Response.json({ ...account, ...balanceData })
}

/**
 * GET /api/accounts/with-balance
 * Returns the accounts list (respecting standard query params) with balance data appended to each doc.
 */
export const accountsWithBalanceHandler: PayloadHandler = async (req) => {
  const { payload, user, query } = req

  if (!user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const searchParams = query as Record<string, string>
  const page = searchParams?.page ? Number(searchParams.page) : 1
  const limit = searchParams?.limit ? Number(searchParams.limit) : 10

  const accounts = await payload.find({
    collection: 'accounts',
    depth: 1,
    overrideAccess: false,
    req,
    page,
    limit,
  })

  const docs = await Promise.all(
    accounts.docs.map(async (account) => {
      const balanceData = await calculateAccountBalance(payload, account.id)
      return { ...account, ...balanceData }
    }),
  )

  return Response.json({ ...accounts, docs })
}
