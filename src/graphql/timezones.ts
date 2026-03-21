import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString, GraphQLInt } from 'graphql'
import { timezones } from '../data/timezones'

const TimezoneType = new GraphQLObjectType({
  name: 'Timezone',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    region: { type: new GraphQLNonNull(GraphQLString) },
    city: { type: new GraphQLNonNull(GraphQLString) },
    offset: { type: new GraphQLNonNull(GraphQLString) },
    label: { type: new GraphQLNonNull(GraphQLString) },
  },
})

const TimezonesResultType = new GraphQLObjectType({
  name: 'TimezonesResult',
  fields: {
    docs: { type: new GraphQLList(TimezoneType) },
    totalDocs: { type: GraphQLInt },
  },
})

export const timezoneQueries = () => ({
  /**
   * query { timezones { docs { id region city offset label } totalDocs } }
   */
  timezones: {
    type: TimezonesResultType,
    resolve: () => ({ docs: timezones, totalDocs: timezones.length }),
  },

  /**
   * query { timezone(id: "America/New_York") { id city offset label } }
   */
  timezone: {
    type: TimezoneType,
    args: {
      id: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: (_: unknown, { id }: { id: string }) => {
      return timezones.find((tz) => tz.id === id) ?? null
    },
  },
})
