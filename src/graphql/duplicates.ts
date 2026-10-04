import { GraphQLList, GraphQLNonNull, GraphQLScalarType, GraphQLString } from 'graphql'
import { findPossibleDuplicates } from '../utilities/duplicates'

const DuplicateJSON = new GraphQLScalarType({
  name: 'PossibleDuplicate',
  description: '{ kind: "transaction" | "sms", id, title, amount, date }',
  serialize: (v) => v,
})

export const duplicateQueries = () => ({
  /** query { possibleDuplicates(type: "expense", amount: "20", date: "…", title: "Tea") } */
  possibleDuplicates: {
    type: new GraphQLList(DuplicateJSON),
    args: {
      type: { type: new GraphQLNonNull(GraphQLString) },
      amount: { type: new GraphQLNonNull(GraphQLString) },
      date: { type: new GraphQLNonNull(GraphQLString) },
      title: { type: GraphQLString },
      exclude: { type: GraphQLString, description: 'Transaction being edited' },
    },
    resolve: async (
      _: unknown,
      args: { type: string; amount: string; date: string; title?: string; exclude?: string },
      { req }: { req: any },
    ) => {
      if (!req.user) throw new Error('Unauthorized')
      return findPossibleDuplicates(req.payload, String(req.user.id), {
        ...args,
        exclude: args.exclude ? [args.exclude] : [],
      })
    },
  },
})
