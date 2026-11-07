import { GraphQLList, GraphQLNonNull, GraphQLScalarType, GraphQLString, Kind } from 'graphql'
import { similarTransactionIds } from '../utilities/ai/user-history'
import { searchSummary } from '../utilities/search/searchSummary'
import { calculateInsights } from '../utilities/insights'
import { budgetsOverview } from '../utilities/budgets'
import { getUserTimezone } from '../utilities/getUserTimezone'

const AnyJSON = new GraphQLScalarType({
  name: 'SearchJSON',
  description: 'JSON (search where / summary / insights)',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? JSON.parse(ast.value) : null),
})

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
  },  /**
   * query { searchSummary(where: {...}) }
   * Totals for the transactions this where matches — the same where the app lists with
   * (GraphQL shape). Scoped to the signed-in user. { count, spent, received, averageSpend, months }
   */
  searchSummary: {
    type: new GraphQLNonNull(AnyJSON),
    args: { where: { type: AnyJSON } },
    resolve: async (_: unknown, args: { where?: Record<string, unknown> | null }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      const tz = await getUserTimezone(req)
      const { where: _where, ...summary } = await searchSummary(req.payload, String(req.user.id), args.where, tz)
      return summary
    },
  },
  /** query { insights } — what stands out this month (see utilities/insights.ts). */
  insights: {
    type: new GraphQLNonNull(AnyJSON),
    resolve: async (_: unknown, __: unknown, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return calculateInsights(req.payload, String(req.user.id), await getUserTimezone(req))
    },
  },  /** query { budgetsOverview } — this month's progress for each active budget. */
  budgetsOverview: {
    type: new GraphQLNonNull(AnyJSON),
    resolve: async (_: unknown, __: unknown, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return budgetsOverview(req.payload, String(req.user.id), await getUserTimezone(req))
    },
  },
})
