import { GraphQLInt, GraphQLList, GraphQLScalarType } from 'graphql'
import { categoryReview } from '../utilities/ai/user-history'

const CategoryReviewJSON = new GraphQLScalarType({
  name: 'CategoryReviewItem',
  description: '{ transaction: { id, title, amount, date, type }, current, suggested, score }',
  serialize: (v) => v,
})

export const categoryReviewQueries = () => ({
  /** query { categoryReview } — recent transactions whose category similar ones disagree with */
  categoryReview: {
    type: new GraphQLList(CategoryReviewJSON),
    args: { days: { type: GraphQLInt, description: 'How far back to look (default 60, 7-365)' } },
    resolve: async (_: unknown, args: { days?: number | null }, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      const days = Math.min(365, Math.max(7, args.days ?? 60))
      // Needs the embedding model; without it there's simply nothing to review.
      return categoryReview(req.payload, String(req.user.id), { days }).catch(() => [])
    },
  },
})
