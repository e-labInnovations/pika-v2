import {
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'
import { currencies } from '../data/currencies'

const CurrencyType = new GraphQLObjectType({
  name: 'Currency',
  fields: {
    code: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    symbol: { type: new GraphQLNonNull(GraphQLString) },
    symbol_native: { type: new GraphQLNonNull(GraphQLString) },
    name_plural: { type: new GraphQLNonNull(GraphQLString) },
    decimal_digits: { type: new GraphQLNonNull(GraphQLInt) },
    rounding: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const CurrenciesResultType = new GraphQLObjectType({
  name: 'CurrenciesResult',
  fields: {
    docs: { type: new GraphQLList(CurrencyType) },
    totalDocs: { type: GraphQLInt },
  },
})

export const currencyQueries = () => ({
  /**
   * query { currencies { docs { code name symbol } totalDocs } }
   */
  currencies: {
    type: CurrenciesResultType,
    resolve: () => {
      const docs = Object.values(currencies).sort((a, b) => a.code.localeCompare(b.code))
      return { docs, totalDocs: docs.length }
    },
  },

  /**
   * query { currency(code: "USD") { code name symbol decimal_digits } }
   */
  currency: {
    type: CurrencyType,
    args: {
      code: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: (_: unknown, { code }: { code: string }) => {
      return currencies[code.toUpperCase()] ?? null
    },
  },
})
