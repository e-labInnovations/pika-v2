import { GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { similarTransactionIds } from '../utilities/ai/user-history'

export const searchQueries = () => ({
  /**
   * query { similarTransactionIds(query: "coffee") }
   * Transactions whose titles mean something close to the search, best first; the app
   * ORs them with its title/note text match.
   */
  similarTransactionIds: {
    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
    args: { query: { type: new GraphQLNonNull(GraphQLString) } },
    resolve: async (_: unknown, args: { query: string }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      // The model may be unavailable; text search still works without it.
      return similarTransactionIds(req.payload, String(req.user.id), args.query).catch(() => [])
    },
  },
})
