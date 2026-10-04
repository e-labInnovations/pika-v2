import { GraphQLScalarType } from 'graphql'
import { recurringOverview } from '../utilities/recurring'

const RecurringJSON = new GraphQLScalarType({
  name: 'RecurringOverview',
  description: '{ suggestions: detected monthly payments not yet tracked, due: tracked reminders due soon or missed }',
  serialize: (v) => v,
})

export const recurringQueries = () => ({
  /** query { recurringOverview } */
  recurringOverview: {
    type: RecurringJSON,
    resolve: async (_: unknown, __: unknown, { req }: { req: any }) => {
      if (!req.user) throw new Error('Unauthorized')
      return recurringOverview(req.payload, req.user)
    },
  },
})
