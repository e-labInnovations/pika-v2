import { currencyQueries } from './currencies'
import { timezoneQueries } from './timezones'
import { analyticsQueries } from './analytics'
import { aiMutations } from './ai'

export const graphQLQueries = () => ({
  ...currencyQueries(),
  ...timezoneQueries(),
  ...analyticsQueries(),
})

export const graphQLMutations = () => ({
  ...aiMutations(),
})
