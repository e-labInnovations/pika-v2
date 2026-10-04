import { GraphQLBoolean, GraphQLFloat, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { checkBalances } from '../utilities/balanceCheck'

const BalanceCheckType = new GraphQLObjectType({
  name: 'BalanceCheck',
  fields: {
    account: { type: new GraphQLNonNull(GraphQLString) },
    accountName: { type: GraphQLString },
    bankBalance: { type: new GraphQLNonNull(GraphQLFloat) },
    pikaBalance: { type: new GraphQLNonNull(GraphQLFloat) },
    difference: { type: new GraphQLNonNull(GraphQLFloat), description: 'bankBalance - pikaBalance' },
    matched: { type: new GraphQLNonNull(GraphQLBoolean) },
    asOf: { type: new GraphQLNonNull(GraphQLString) },
    sms: { type: new GraphQLNonNull(GraphQLString) },
    lastMatchedAt: { type: GraphQLString },
    firstOffAt: { type: GraphQLString },
    pending: { type: new GraphQLNonNull(GraphQLInt) },
  },
})

export const balanceCheckQueries = () => ({
  /** query { balanceChecks { account accountName bankBalance pikaBalance difference matched asOf lastMatchedAt } } */
  balanceChecks: {
    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BalanceCheckType))),
    resolve: async (_: unknown, __: unknown, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      const checks = await checkBalances(req.payload, String(req.user.id))
      if (!checks.length) return []
      const accounts = await req.payload.find({
        collection: 'accounts',
        where: { id: { in: checks.map((c) => c.account) } },
        depth: 0,
        pagination: false,
        select: { name: true, isActive: true },
        overrideAccess: false,
        user: req.user,
      })
      const byId = new Map<string, any>(accounts.docs.map((a: any) => [String(a.id), a]))
      return checks
        .filter((c) => byId.get(c.account)?.isActive !== false)
        .map((c) => ({ ...c, accountName: byId.get(c.account)?.name ?? null }))
    },
  },
})
