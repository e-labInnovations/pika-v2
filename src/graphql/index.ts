import { currencyQueries } from './currencies'
import { timezoneQueries } from './timezones'

export const graphQLQueries = () => ({
  ...currencyQueries(),
  ...timezoneQueries(),
})
