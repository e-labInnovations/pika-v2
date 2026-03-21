import {
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLBoolean,
} from 'graphql'
import { calculateAccountBalance } from '../utilities/calculateAccountBalance'

/** Matches the Payload-generated Account shape + computed balance fields */
const AccountWithBalanceType = new GraphQLObjectType({
  name: 'AccountWithBalance',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: GraphQLString },
    description: { type: GraphQLString },
    icon: { type: GraphQLString },
    bgColor: { type: GraphQLString },
    color: { type: GraphQLString },
    isActive: { type: GraphQLBoolean },
    // Computed fields
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    totalTransactions: { type: new GraphQLNonNull(GraphQLInt) },
    lastTransactionAt: { type: GraphQLString },
  },
})

const AccountsWithBalanceType = new GraphQLObjectType({
  name: 'AccountsWithBalance',
  fields: {
    docs: { type: new GraphQLList(AccountWithBalanceType) },
    totalDocs: { type: GraphQLInt },
    page: { type: GraphQLInt },
    totalPages: { type: GraphQLInt },
    hasNextPage: { type: GraphQLBoolean },
    hasPrevPage: { type: GraphQLBoolean },
  },
})

export const accountBalanceQueries = () => ({
  /**
   * query { accountWithBalance(id: "...") { id name balance totalTransactions lastTransactionAt } }
   */
  accountWithBalance: {
    type: AccountWithBalanceType,
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (_: unknown, { id }: { id: string }, context: { req: any }) => {
      const { req } = context
      const { payload } = req

      const account = await payload.findByID({
        collection: 'accounts',
        id,
        depth: 0,
        overrideAccess: false,
        req,
      })

      const balanceData = await calculateAccountBalance(payload, id)
      return { ...account, ...balanceData }
    },
  },

  /**
   * query { accountsWithBalance(page: 1, limit: 10) { docs { id name balance } totalDocs } }
   */
  accountsWithBalance: {
    type: AccountsWithBalanceType,
    args: {
      page: { type: GraphQLInt },
      limit: { type: GraphQLInt },
    },
    resolve: async (
      _: unknown,
      { page = 1, limit = 10 }: { page?: number; limit?: number },
      context: { req: any },
    ) => {
      const { req } = context
      const { payload } = req

      const accounts = await payload.find({
        collection: 'accounts',
        depth: 0,
        overrideAccess: false,
        req,
        page,
        limit,
      })

      const docs = await Promise.all(
        accounts.docs.map(async (account: any) => {
          const balanceData = await calculateAccountBalance(payload, account.id)
          return { ...account, ...balanceData }
        }),
      )

      return { ...accounts, docs }
    },
  },
})
